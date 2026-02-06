class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.7.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-arm64"
      sha256 "fa24a58cf397e7e5c25855765d1dddc8851f73de81d1a4ccaa670cd11bf5787f"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-x64"
      sha256 "43d544fdda94a1516a718b119e0ff86770617cf69470fbc039f861d3c4585cfb"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-linux-x64"
    sha256 "1b1144c77835718d0b4799c1901f5daa1128349a6b8bb492551aa78dd4c16008"
  end

  def install
    binary = Dir["owo-*"].first || "owo"
    bin.install binary => "owo"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo --version")
  end
end
