-- Keep only nearby lamps enabled to preserve rendering detail along the full loop.
local player = game.Players.LocalPlayer
local scene = workspace:WaitForChild("lumphini"):WaitForChild("RunningExperience")
local lights = {}
for _, v in scene:GetDescendants() do if v:IsA("SpotLight") then table.insert(lights,v) end end
while true do
    local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
    if root then
        for _, light in lights do light.Enabled = (light.Parent.Position-root.Position).Magnitude < 180 end
    end
    task.wait(.5)
end
