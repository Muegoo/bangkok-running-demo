local player = game.Players.LocalPlayer
-- Keep Roblox's default chat overlay from intercepting the park controls.
pcall(function() game:GetService("StarterGui"):SetCoreGuiEnabled(Enum.CoreGuiType.Chat, false) end)
local switch = game.ReplicatedStorage:WaitForChild("SelectPark")
local gui = Instance.new("ScreenGui")
gui.Name = "BangkokRunningDemo"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")
local panel = Instance.new("Frame")
panel.Name = "RunPanel"
panel.Size = UDim2.new(0.92, 0, 0, 114)
panel.Position = UDim2.fromOffset(18, 14)
panel.BackgroundColor3 = Color3.fromRGB(19, 31, 29)
panel.BackgroundTransparency = 0.2
panel.Parent = gui
local limit = Instance.new("UISizeConstraint", panel)
limit.MaxSize = Vector2.new(350, 114)
Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 12)
local function text(name, parent, value, pos, size, fontSize)
    local label = Instance.new("TextLabel")
    label.Name = name
    label.Text = value
    label.Position = pos
    label.Size = size
    label.BackgroundTransparency = 1
    label.TextColor3 = Color3.fromRGB(239, 242, 229)
    label.TextXAlignment = Enum.TextXAlignment.Left
    label.Font = Enum.Font.GothamMedium
    label.TextSize = fontSize
    label.Parent = parent
    return label
end
local title = text("ParkName", panel, "สวนลุมพินี", UDim2.fromOffset(14, 8), UDim2.new(1, -28, 0, 25), 19)
local stats = text("Stats", panel, "0 ม.     00:00", UDim2.fromOffset(14, 35), UDim2.new(1, -28, 0, 28), 22)
local function button(name, value, x, callback)
    local b = Instance.new("TextButton")
    b.Name = name
    b.Text = value
    b.Position = UDim2.fromOffset(x, 76)
    b.Size = UDim2.fromOffset(104, 28)
    b.BackgroundColor3 = Color3.fromRGB(56, 78, 66)
    b.TextColor3 = Color3.fromRGB(240, 243, 230)
    b.Font = Enum.Font.GothamMedium
    b.TextSize = 14
    b.Parent = panel
    Instance.new("UICorner", b).CornerRadius = UDim.new(0, 7)
    b.Activated:Connect(callback)
    return b
end
button("Select_lumphini", "ลุมพินี", 14, function() switch:FireServer("lumphini") end)
button("Select_benjakitti", "เบญจกิติ", 124, function() switch:FireServer("benjakitti") end)
local view = button("CameraView", "มุมมอง · V", 234, function()
    player:SetAttribute("FirstPersonView", player:GetAttribute("FirstPersonView") ~= true)
end)
view.Size = UDim2.fromOffset(102, 28)
local function update()
    title.Text = player:GetAttribute("ParkName") or "สวนลุมพินี"
    local seconds = player:GetAttribute("RunningSeconds") or 0
    stats.Text = string.format("%d ม.     %02d:%02d", player:GetAttribute("DistanceMeters") or 0, math.floor(seconds / 60), seconds % 60)
    view.Text = if player:GetAttribute("FirstPersonView") then "สายตา · V" else "ตามหลัง · V"
end
for _, key in {"ParkName", "DistanceMeters", "RunningSeconds", "FirstPersonView"} do
    player:GetAttributeChangedSignal(key):Connect(update)
end
text("Controls", gui, "WASD วิ่ง · ลากเมาส์ขวาเพื่อมองรอบตัว · V เปลี่ยนมุมมอง", UDim2.new(0, 18, 1, -58), UDim2.new(1, -36, 0, 24), 13)
text("Attribution", gui, "Map data © OpenStreetMap contributors · ODbL", UDim2.new(0, 18, 1, -31), UDim2.new(1, -36, 0, 20), 11)
update()
