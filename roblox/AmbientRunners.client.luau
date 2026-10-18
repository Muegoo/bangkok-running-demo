-- Decorative runners animate locally; they have no collision or gameplay authority.
local RunService = game:GetService("RunService")
local player = game.Players.LocalPlayer
local routes = {}
local function register(scene)
    if routes[scene] or not scene:FindFirstChild("Waypoints") then return end
    local points = scene.Waypoints:GetChildren()
    table.sort(points, function(a,b) return a.Name < b.Name end)
    if #points < 2 then return end
    local distances = {0}
    for i = 2, #points do distances[i] = distances[i-1] + (points[i].Position-points[i-1].Position).Magnitude end
    local runners = {}
    for _, model in scene:GetChildren() do
        if model:IsA("Model") and model.Name:match("^Runner_") then
            local offsets = {}
            local base = CFrame.new(model.Torso.Position - Vector3.new(0,2.9,0)) * model.Torso.CFrame.Rotation
            for _, part in model:GetChildren() do
                if part:IsA("BasePart") then offsets[part] = base:ToObjectSpace(part.CFrame) end
            end
            table.insert(runners, {model=model, offsets=offsets, phase=#runners*110+60})
        end
    end
    routes[scene] = {points=points, distances=distances, total=distances[#distances], runners=runners}
end
for _, park in {"lumphini", "benjakitti"} do
    register(workspace:WaitForChild(park):WaitForChild("RunningExperience"))
end
local elapsed, accumulator = 0, 0
RunService.Heartbeat:Connect(function(dt)
    elapsed += dt
    accumulator += dt
    if accumulator < 1/30 then return end
    accumulator = 0
    local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
    if not root then return end
    for _, route in routes do
        for _, runner in route.runners do
            local progress = (elapsed*8 + runner.phase) % (route.total*2)
            local reversed = progress > route.total
            local d = if reversed then route.total*2-progress else progress
            local index = 2
            while index < #route.points and route.distances[index] < d do index += 1 end
            local a, b = route.points[index-1].Position, route.points[index].Position
            local t = (d-route.distances[index-1]) / math.max(0.001, route.distances[index]-route.distances[index-1])
            local direction = (b-a).Unit * (if reversed then -1 else 1)
            local side = Vector3.new(-direction.Z,0,direction.X)*1.4
            local pos = a:Lerp(b,t) + side
            if (pos-root.Position).Magnitude < 320 then
                local pivot = CFrame.lookAt(pos, pos+direction)
                local swing = math.sin(elapsed*10 + runner.phase)*0.65
                for part, offset in runner.offsets do
                    local factor = if part.Name == "LeftLeg" or part.Name == "RightArm" then 1 elseif part.Name == "RightLeg" or part.Name == "LeftArm" then -1 else 0
                    part.CFrame = pivot * offset * CFrame.Angles(swing*factor,0,0)
                end
            end
        end
    end
end)
