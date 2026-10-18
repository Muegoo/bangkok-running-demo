local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Input = game:GetService("UserInputService")
local player = Players.LocalPlayer
local config = require(game.ReplicatedStorage:WaitForChild("ParkConfig"))
local yaw, pitch, dragging = 0, -0.035, false
local touchLook = nil
local firstPerson = false
local currentCharacter, bodyParts = nil, {}
local parkLights = {}
local function align()
    -- Reserve local-light rendering for the park the player is actually visiting.
    for id, park in config.parks do
        if not parkLights[id] then
            local model = workspace:FindFirstChild(id)
            local scene = model and model:FindFirstChild("RunningExperience")
            if scene then
                parkLights[id] = {}
                for _, light in scene:GetDescendants() do
                    if light:IsA("SpotLight") then table.insert(parkLights[id], light) end
                end
            end
        end
        for _, light in parkLights[id] or {} do
            light.Enabled = park.name == player:GetAttribute("ParkName")
        end
    end
    for _, park in config.parks do
        if park.name == player:GetAttribute("ParkName") and park.forward then
            yaw = math.atan2(-park.forward[1], -park.forward[3])
            pitch = -0.035
        end
    end
end
local function visibility()
    firstPerson = player:GetAttribute("FirstPersonView") == true
    for _, part in bodyParts do
        if part.Parent then part.LocalTransparencyModifier = if firstPerson then 1 else 0 end
    end
end
local function characterAdded(character)
    currentCharacter = character
    bodyParts = {}
    for _, part in character:GetDescendants() do
        if part:IsA("BasePart") then table.insert(bodyParts, part) end
    end
    character.DescendantAdded:Connect(function(part)
        if part:IsA("BasePart") then table.insert(bodyParts, part); visibility() end
    end)
    align()
    visibility()
end
player.CharacterAdded:Connect(characterAdded)
if player.Character then characterAdded(player.Character) end
player:GetAttributeChangedSignal("ParkName"):Connect(align)
player:GetAttributeChangedSignal("FirstPersonView"):Connect(visibility)
Input.InputBegan:Connect(function(input, processed)
    if processed then return end
    if input.KeyCode == Enum.KeyCode.V then
        player:SetAttribute("FirstPersonView", not firstPerson)
    elseif input.UserInputType == Enum.UserInputType.MouseButton2 then
        dragging = true
        Input.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition
    elseif input.UserInputType == Enum.UserInputType.Touch then
        local camera = workspace.CurrentCamera
        if camera and input.Position.X > camera.ViewportSize.X * 0.55 then touchLook = input end
    end
end)
Input.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton2 then
        dragging = false
        Input.MouseBehavior = Enum.MouseBehavior.Default
    end
    if input == touchLook then touchLook = nil end
end)
Input.WindowFocusReleased:Connect(function()
    dragging = false
    touchLook = nil
    Input.MouseBehavior = Enum.MouseBehavior.Default
end)
Input.InputChanged:Connect(function(input)
    if (dragging and input.UserInputType == Enum.UserInputType.MouseMovement) or input == touchLook then
        yaw -= input.Delta.X * 0.0035
        pitch = math.clamp(pitch - input.Delta.Y * 0.0025, -0.45, 0.3)
    end
end)
align()
local ray = RaycastParams.new()
ray.FilterType = Enum.RaycastFilterType.Exclude
RunService:BindToRenderStep("ParkRunningCamera", Enum.RenderPriority.Camera.Value + 1, function()
    local camera = workspace.CurrentCamera
    local root = currentCharacter and currentCharacter:FindFirstChild("HumanoidRootPart")
    local humanoid = currentCharacter and currentCharacter:FindFirstChildOfClass("Humanoid")
    if not camera or not root or not humanoid then return end
    local rotation = CFrame.fromOrientation(pitch, yaw, 0)
    local forward = rotation.LookVector
    local eye = root.Position + Vector3.new(0, 1.8, 0)
    local bob = if humanoid.MoveDirection.Magnitude > 0.1 then math.sin(os.clock() * 13) * 0.035 else 0
    local desired = eye + Vector3.new(0, bob, 0)
    if not firstPerson then
        desired += -forward * 6.5 + rotation.RightVector * 1.0 + Vector3.new(0, 1.25, 0)
        ray.FilterDescendantsInstances = {currentCharacter}
        local hit = workspace:Raycast(eye, desired - eye, ray)
        if hit then desired = hit.Position + hit.Normal * 0.35 end
    end
    camera.CameraType = Enum.CameraType.Scriptable
    camera.FieldOfView = 68
    camera.CFrame = CFrame.lookAt(desired, desired + forward * 100)
    camera.Focus = CFrame.new(eye + forward * 12)
    visibility()
end)
