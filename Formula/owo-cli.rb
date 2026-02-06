class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.7.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-arm64"
      sha256 "68e344fc197a2f35ad625d2cba6ec7da8d0bde60d6e093f8d41b332bb4fc16e8"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-x64"
      sha256 "bca246e7a3e64436a3a529c938180f67023d9b8f114f90d04e90bbf3b4b46636"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-linux-x64"
    sha256 "7a3920116daa387cd3dfb7f7b3fd2451f17323f44dfd5bab7b6a92083b26374a"
  end

  def install
    binary = Dir["owo-*"].first || "owo"
    bin.install binary => "owo"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo --version")
  end
end
