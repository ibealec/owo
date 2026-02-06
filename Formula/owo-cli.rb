class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.1.3"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-cli-darwin-arm64"
      sha256 "85e52ca1d2775f8f210b92d7e2d705b850d3b39ffdbb2d29bb3b645868b54434"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-cli-darwin-x64"
      sha256 "5eca0ac7cac65a952fa0f360c6a5960feb9abb0de636fdf90c28d5b5b4d8abe3"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-cli-linux-x64"
    sha256 "459ebaf0a5e3942b1ce637dd82408d9cca11d313d0e3112fb98e1a688bfbc875"
  end

  def install
    binary = Dir["owo-cli-*"].first || "owo-cli"
    bin.install binary => "owo-cli"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo-cli --version")
  end
end
