class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.1.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-cli-darwin-arm64"
      sha256 "cac0285e58a4380207ab06fe17dfa5bcfd2935ea5480d6ac4ce337230259ff0d"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-cli-darwin-x64"
      sha256 "4a8a7d735596187b8e8a486cf848c6b7f7dc79c1af77a850d7c2c0cfc6e9d7fe"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-cli-linux-x64"
    sha256 "acf3bfe498bb28e004edbeb54afa7cdcf2a0a24ba8f1b4af65a22c215ee3f644"
  end

  def install
    binary = Dir["owo-cli-*"].first || "owo-cli"
    bin.install binary => "owo-cli"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo-cli --version")
  end
end
