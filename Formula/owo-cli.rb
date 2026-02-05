class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/context-labs/uwu"
  version "1.1.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/context-labs/uwu/releases/download/v#{version}/owo-cli-darwin-arm64"
      sha256 "PLACEHOLDER_DARWIN_ARM64"
    else
      url "https://github.com/context-labs/uwu/releases/download/v#{version}/owo-cli-darwin-x64"
      sha256 "PLACEHOLDER_DARWIN_X64"
    end
  end

  on_linux do
    url "https://github.com/context-labs/uwu/releases/download/v#{version}/owo-cli-linux-x64"
    sha256 "PLACEHOLDER_LINUX_X64"
  end

  def install
    binary = Dir["owo-cli-*"].first || "owo-cli"
    bin.install binary => "owo-cli"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo-cli --version")
  end
end
