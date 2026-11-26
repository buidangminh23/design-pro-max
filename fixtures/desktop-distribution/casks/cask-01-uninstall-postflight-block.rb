cask "relay" do
  version "2.1.0"
  sha256 "1111111111111111111111111111111111111111111111111111111111111111"

  url "https://downloads.example.com/Relay-#{version}.zip"
  name "Relay"
  desc "Example menu bar relay"
  homepage "https://example.com/relay"

  auto_updates true

  app "Relay.app"

  uninstall_postflight do
    puts "removed"
  end

  uninstall quit: "com.example.relay"

  zap login_item: "Relay",
      trash:      "~/Library/Application Support/com.example.relay"
end
