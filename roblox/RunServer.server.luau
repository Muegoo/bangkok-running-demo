-- Demo settings are deliberately separate from real survey measurements.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local config = require(ReplicatedStorage:WaitForChild("ParkConfig"))
local switch = ReplicatedStorage:WaitForChild("SelectPark")
local states = {}

local function enterPark(player, parkId)
    local park = config.parks[parkId]
    local state = states[player]
    if not park or not state then return end
    state.park = parkId
    state.last = nil
    state.distance = 0
    state.elapsed = 0
    player:SetAttribute("ParkName", park.name)
    player:SetAttribute("DistanceMeters", 0)
    player:SetAttribute("RunningSeconds", 0)
    local character = player.Character
    if character and character:FindFirstChild("HumanoidRootPart") then
        local position = Vector3.new(table.unpack(park.spawn))
        local forward = Vector3.new(table.unpack(park.forward or {0, 0, -1}))
        character:PivotTo(CFrame.lookAt(position, position + forward))
        local root = character:FindFirstChild("HumanoidRootPart")
        root.AssemblyLinearVelocity = Vector3.zero
        root.AssemblyAngularVelocity = Vector3.zero
    end
end

local function setup(player)
    states[player] = {park = "lumphini", distance = 0, elapsed = 0, cooldown = 0, publish = 0}
    local function characterAdded(character)
        local humanoid = character:WaitForChild("Humanoid", 15)
        local root = character:WaitForChild("HumanoidRootPart", 15)
        -- Let Roblox finish placing the character before selecting our route spawn.
        task.wait(0.15)
        if humanoid and root and states[player] and player.Character == character then
            humanoid.WalkSpeed = config.runSpeedStuds
            enterPark(player, states[player].park)
        end
    end
    player.CharacterAdded:Connect(characterAdded)
    if player.Character then task.spawn(characterAdded, player.Character) end
    player:SetAttribute("ParkName", config.parks.lumphini.name)
end
Players.PlayerAdded:Connect(setup)
for _, player in Players:GetPlayers() do setup(player) end
Players.PlayerRemoving:Connect(function(player) states[player] = nil end)
switch.OnServerEvent:Connect(function(player, parkId)
    local state = states[player]
    if type(parkId) ~= "string" or not config.parks[parkId] or not state then return end
    if os.clock() - state.cooldown < 1 then return end
    state.cooldown = os.clock()
    enterPark(player, parkId)
end)

RunService.Heartbeat:Connect(function(dt)
    for player, state in states do
        local character = player.Character
        local root = character and character:FindFirstChild("HumanoidRootPart")
        local humanoid = character and character:FindFirstChild("Humanoid")
        if root and humanoid and humanoid.Health > 0 then
            local current = Vector2.new(root.Position.X, root.Position.Z)
            if state.last and humanoid.FloorMaterial ~= Enum.Material.Air then
                local moved = (current-state.last).Magnitude
                -- Exclude teleports and spikes; this is a demo movement counter, not a race record.
                if moved > 0.005 and moved <= config.runSpeedStuds*dt*2 + 1 then
                    state.distance += moved/config.studsPerMeter
                    state.elapsed += dt
                end
            end
            state.last = current
            state.publish += dt
            if state.publish >= 0.25 then
                state.publish = 0
                player:SetAttribute("DistanceMeters", math.floor(state.distance))
                player:SetAttribute("RunningSeconds", math.floor(state.elapsed))
            end
        else
            state.last = nil
        end
    end
end)
