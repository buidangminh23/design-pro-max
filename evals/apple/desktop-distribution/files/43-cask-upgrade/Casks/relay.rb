cask "relay" do
  version "2.1.0"
  sha256 "1111111111111111111111111111111111111111111111111111111111111111"

  url "https://downloads.example.com/Relay-#{version}.zip"
  name "Relay"
  desc "Menu bar relay"
  homepage "https://example.com/relay"

  app "Relay.app"

  postflight do
    system_command "/usr/bin/open", args: ["-a", "Relay"]
  end

  uninstall quit:       "com.example.relay",
            login_item: "Relay",
            delete:     "~/Library/Application Support/com.example.relay"
end
