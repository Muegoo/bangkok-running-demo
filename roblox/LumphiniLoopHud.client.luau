local p = game.Players.LocalPlayer
local config = require(game.ReplicatedStorage:WaitForChild("ParkConfig"))
pcall(function() game:GetService("StarterGui"):SetCoreGuiEnabled(Enum.CoreGuiType.Chat, false) end)
local gui = Instance.new("ScreenGui")
gui.Name = "LumphiniLoopHUD"
gui.ResetOnSpawn = false
gui.Parent = p:WaitForChild("PlayerGui")
local panel = Instance.new("Frame", gui)
panel.Size = UDim2.fromOffset(310, 112)
panel.Position = UDim2.fromOffset(18, 14)
panel.BackgroundColor3 = Color3.fromRGB(20, 35, 29)
panel.BackgroundTransparency = .15
Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 12)
local function label(text, y, size)
    local t = Instance.new("TextLabel", panel)
    t.BackgroundTransparency = 1
    t.Position = UDim2.fromOffset(14, y)
    t.Size = UDim2.new(1, -28, 0, 28)
    t.TextXAlignment = Enum.TextXAlignment.Left
    t.Font = Enum.Font.GothamMedium
    t.TextColor3 = Color3.fromRGB(239, 243, 229)
    t.TextSize = size
    t.Text = text
    return t
end
label("สวนลุมพินี · เส้นทางทดลอง", 8, 19)
local stats = label("0 ม.   00:00", 37, 24)
label(if config.innerLoopMeters then string.format("วงใหญ่ %.2f กม. · วงใน %.2f กม.",config.loopMeters/1000,config.innerLoopMeters/1000) else string.format("วงรอบทดลอง %.2f กม.", config.loopMeters / 1000), 74, 13)
local view = Instance.new("TextButton", gui)
view.Name = "CameraView"
view.AnchorPoint = Vector2.new(1, 0)
view.Position = UDim2.new(1, -18, 0, 14)
view.Size = UDim2.fromOffset(138, 36)
view.BackgroundColor3 = Color3.fromRGB(40, 64, 50)
view.TextColor3 = Color3.fromRGB(239, 243, 229)
view.Font = Enum.Font.GothamMedium
view.TextSize = 14
Instance.new("UICorner", view).CornerRadius = UDim.new(0, 10)
view.Activated:Connect(function() p:SetAttribute("FirstPersonView",p:GetAttribute("FirstPersonView") ~= true) end)
local function update()
    local seconds = p:GetAttribute("RunningSeconds") or 0
    stats.Text = string.format("%d ม.   %02d:%02d", p:GetAttribute("DistanceMeters") or 0, math.floor(seconds/60),seconds%60)
    view.Text = if p:GetAttribute("FirstPersonView") then "สายตา · V" else "ตามหลัง · V"
end
for _, attr in {"DistanceMeters", "RunningSeconds", "FirstPersonView"} do p:GetAttributeChangedSignal(attr):Connect(update) end
local footer = Instance.new("TextLabel",gui)
footer.BackgroundTransparency = 1
footer.Position = UDim2.new(0,18,1,-54)
footer.Size = UDim2.new(1,-36,0,45)
footer.TextXAlignment = Enum.TextXAlignment.Left
footer.TextSize = 12
footer.TextColor3 = Color3.fromRGB(237,240,225)
footer.Text = "WASD วิ่ง · ลากเมาส์ขวาเพื่อมอง · V เปลี่ยนมุมมอง\nMap data © OpenStreetMap contributors · ODbL"
update()
