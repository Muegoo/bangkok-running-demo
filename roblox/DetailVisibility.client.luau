-- Decorative parts fade with distance; road, ground, collision and route data stay active.
local player = game.Players.LocalPlayer
local scene = workspace:WaitForChild("lumphini"):WaitForChild("RunningExperience")
local entries = {}
for index,part in scene:GetDescendants() do
    if part:IsA("BasePart") then
        local name = part.Name
        local near,far
        if name:match("^ParkTree_") or name:match("^DetailTree_") or name:match("^DetailCrown_") then
            near,far = 440,550
        elseif name:match("^ParkLamp_") then
            near,far = 460,600
        elseif name:match("^Paver_") or name:match("^LeafLitter_") or name:match("^Drain_")
            or name:match("^VergePlant_") or name:match("^GreenBench_") or name:match("^ParkBin_")
            or name:match("^RouteSign_") or name:match("^PlantedMedian_") then
            near,far = 180,260
        end
        if far then table.insert(entries,{part=part,near=near,far=far,shadow=part.CastShadow}) end
    end
    if index%800 == 0 then task.wait() end
end
while true do
    local character = player.Character
    local root = character and character:FindFirstChild("HumanoidRootPart")
    if root then
        for _,entry in entries do
            local part = entry.part
            if part.Parent then
                local distance = (part.Position-root.Position).Magnitude
                local fade = math.clamp((distance-entry.near)/(entry.far-entry.near),0,1)
                if math.abs(part.LocalTransparencyModifier-fade)>.025 then part.LocalTransparencyModifier=fade end
                local shadow = entry.shadow and fade<.9
                if part.CastShadow~=shadow then part.CastShadow=shadow end
            end
        end
    end
    task.wait(.7)
end
