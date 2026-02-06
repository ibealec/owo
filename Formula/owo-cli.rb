class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.6.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-arm64"
      sha256 "5687037d0d9e61b5060e3efa45db9207d763b36417f835833d73c6a6a6b960fd"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-x64"
      sha256 "91ff65f8ff6a4fb72ffe7ad24df5f226e1e4103dc90c99201f2902aa388fae68"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-linux-x64"
    sha256 "9c5c01fe27ec5d75b408df02ed09b5c0702f97408d4ef94cfdf9b16ae6d51b14"
  end

  def install
    binary = Dir["owo-*"].first || "owo"
    bin.install binary => "owo"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo --version")
  end
end
