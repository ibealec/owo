class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.3.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-arm64"
      sha256 "717c35ece7b4fe8681b30718d63174f4254f4ec50e55162d780148883f3e43c5"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-x64"
      sha256 "0c3962ffce7d7f54fd73423afbd3b0564c2e8d4a4338303539169db797e6eee1"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-linux-x64"
    sha256 "1be42d6891d464211eafc63a27fbb1c9e5e9fc1ecd46430559ba83f95765612e"
  end

  def install
    binary = Dir["owo-*"].first || "owo"
    bin.install binary => "owo"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo --version")
  end
end
