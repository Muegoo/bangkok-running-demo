local Lighting = game:GetService("Lighting")
local UserInputService = game:GetService("UserInputService")
local player = game.Players.LocalPlayer
local gui = Instance.new("ScreenGui")
gui.Name = "ParkLightControls"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")
local button = Instance.new("TextButton",gui)
button.AnchorPoint = Vector2.new(1,0)
button.Position = UDim2.new(1,-18,0,58)
button.Size = UDim2.fromOffset(138,36)
button.BackgroundColor3 = Color3.fromRGB(40,64,50)
button.TextColor3 = Color3.fromRGB(239,243,229)
button.Font = Enum.Font.GothamMedium
button.TextSize = 14
Instance.new("UICorner",button).CornerRadius = UDim.new(0,10)
local day = false
local function update()
    Lighting.ClockTime = if day then 14 else 18.7
    Lighting.ExposureCompensation = if day then -.1 else .25
    Lighting.Ambient = if day then Color3.fromRGB(115,125,108) else Color3.fromRGB(100,109,103)
    Lighting.OutdoorAmbient = if day then Color3.fromRGB(138,145,130) else Color3.fromRGB(99,109,118)
    button.Text = if day then "กลางวัน · N" else "ช่วงค่ำ · N"
end
local function toggle() day = not day; update() end
button.Activated:Connect(toggle)
UserInputService.InputBegan:Connect(function(input,processed)
    if not processed and input.KeyCode == Enum.KeyCode.N then toggle() end
end)
update()
