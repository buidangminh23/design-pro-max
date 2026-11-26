# desktop-distribution cask template (design-pro-max). Rename to <token>.rb in your tap's Casks folder and replace
# every example value. Check it with: brew style --cask <token> and brew audit --cask --new <token>
cask "example" do
  version "1.0.0"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"

  url "https://downloads.example.com/Example-#{version}-macos-universal.zip"
  name "Example"
  desc "Example menu bar app"
  homepage "https://example.com/"

  livecheck do
    url "https://downloads.example.com/latest.json"
    strategy :json do |json|
      json["version"]
    end
  end

  auto_updates true
  depends_on macos: ">= :sonoma"

  app "Example.app"

  uninstall quit: "com.example.app"

  zap login_item: "Example",
      trash:      [
        "~/Library/Application Support/com.example.app",
        "~/Library/Caches/com.example.app",
        "~/Library/Preferences/com.example.app.plist",
      ]
end
