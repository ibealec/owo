class OwoCli < Formula
  desc "Natural language to shell commands using AI"
  homepage "https://github.com/ibealec/owo"
  version "1.6.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-arm64"
      sha256 "dfe50edd8722ff492172a9a3de4b8bb77bbc88cbd9e9141ec9c1a3d0b5531ef7"
    else
      url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-darwin-x64"
      sha256 "2beece6ec1e0c87cc1b3e2208f410290c0af3f79b8497294f6113e344b7639e2"
    end
  end

  on_linux do
    url "https://github.com/ibealec/owo/releases/download/v#{version}/owo-linux-x64"
    sha256 "b1e61ab9a30d44ef55b0721cbfd07435c53aa3b207b4b52a85299487e1a6d32e"
  end

  def install
    binary = Dir["owo-*"].first || "owo"
    bin.install binary => "owo"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/owo --version")
  end
end
