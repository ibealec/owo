class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/context-labs/uwu"
  version "1.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/context-labs/uwu/releases/download/v#{version}/owo-cli-darwin-arm64"
      sha256 "04c2a55ba4a83bed5e6ba2bfe5086c23650f3aed61fa3e1fae34418fabc29fbc"
    else
      url "https://github.com/context-labs/uwu/releases/download/v#{version}/owo-cli-darwin-x64"
      sha256 "e1aad5ca7f585a846c74296229276cf0139aa23d2087f588e86415ad01265371"
    end
  end

  on_linux do
    url "https://github.com/context-labs/uwu/releases/download/v#{version}/owo-cli-linux-x64"
    sha256 "5243990f445e6ed0f350ad7a05dce55580e1d5c2b02ffd5689a6d8235b622aba"
  end

  def install
    binary = Dir["owo-cli-*"].first || "owo-cli"
    bin.install binary => "owo-cli"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo-cli --version")
  end
end
