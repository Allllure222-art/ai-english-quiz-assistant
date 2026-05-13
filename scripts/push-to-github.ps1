# 首次推送到 GitHub（仓库名：ai-english-quiz-assistant）
# 用法（在项目根目录执行）：
#   .\scripts\push-to-github.ps1 -GitHubUser zhangsan
# 把 zhangsan 换成你的 GitHub 用户名（个人主页 URL 里 @ 后面的那一段）。

param(
    [Parameter(Mandatory = $true, HelpMessage = '你的 GitHub 登录名，例如 zhangsan')]
    [string]$GitHubUser
)

$ErrorActionPreference = 'Stop'
$git = 'git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $git = 'C:\Program Files\Git\bin\git.exe'
    if (-not (Test-Path $git)) {
        Write-Error '未找到 Git。请安装 Git for Windows：https://git-scm.com/download/win'
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$repo = 'ai-english-quiz-assistant'
$url = "https://github.com/$GitHubUser/$repo.git"

Write-Host "远程地址: $url" -ForegroundColor Cyan

$remotes = & $git remote 2>$null
if ($remotes -contains 'origin') {
    Write-Host '已存在 origin，正在改为新地址...' -ForegroundColor Yellow
    & $git remote set-url origin $url
} else {
    & $git remote add origin $url
}

& $git push -u origin main
Write-Host '完成。' -ForegroundColor Green
