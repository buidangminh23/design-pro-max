cask "relay" do
  version :latest
  sha256 :no_check

  url "https://downloads.example.com/Relay-#{version}.zip"
  name "Relay"
  desc "Example menu bar relay"
  homepage "https://example.com/relay"

  auto_updates true

  app "Relay.app"

  uninstall quit: "com.example.relay"

  zap login_item: "Relay",
      trash:      "~/Library/Application Support/com.example.relay"
end
