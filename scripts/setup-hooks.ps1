# shiftblame 初始化腳本 — Windows PowerShell
# 設定用戶級 CLAUDE.md（managed block）和用戶級 settings.json（SessionStart compact hook）

$ErrorActionPreference = "Stop"

$claudeDir = Join-Path $env:USERPROFILE ".claude"
$claudeMdPath = Join-Path $claudeDir "CLAUDE.md"
$settingsPath = Join-Path $claudeDir "settings.json"

$managedBlockBegin = "<!-- BEGIN shiftblame:global-entry -->"
$managedBlockEnd = "<!-- END shiftblame:global-entry -->"
$managedContent = "load shiftblame skills. On any shiftblame keyword reload shiftblame skills."
$managedBlock = "$managedBlockBegin`n$managedContent`n$managedBlockEnd"

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# --- CLAUDE.md ---

if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    Write-Host "[OK] 已建立 $claudeDir"
}

if (Test-Path $claudeMdPath) {
    $content = [System.IO.File]::ReadAllText($claudeMdPath, $utf8NoBom)

    # 已有 managed block → 跳過
    if ($content.Contains($managedBlockBegin)) {
        Write-Host "[OK] CLAUDE.md 已含 managed block，跳過"
    }
    else {
        # 有裸文字 → 遷移為 managed block
        $barePattern = "load shiftblame skills\. On any shiftblame keyword reload shiftblame skills\."
        if ($content -match $barePattern) {
            $content = $content -replace $barePattern, $managedBlock
            [System.IO.File]::WriteAllText($claudeMdPath, $content, $utf8NoBom)
            Write-Host "[OK] CLAUDE.md 裸文字已遷移為 managed block"
        }
        else {
            # 追加 managed block
            if (-not $content.EndsWith("`n")) { $content += "`n" }
            $content += "`n$managedBlock`n"
            [System.IO.File]::WriteAllText($claudeMdPath, $content, $utf8NoBom)
            Write-Host "[OK] CLAUDE.md 已追加 managed block"
        }
    }
}
else {
    [System.IO.File]::WriteAllText($claudeMdPath, "$managedBlock`n", $utf8NoBom)
    Write-Host "[OK] 已建立 CLAUDE.md 並寫入 managed block"
}

# --- settings.json (SessionStart compact hook) ---

$hookCommand = "echo load shiftblame skills. On any shiftblame keyword reload shiftblame skills."

$compactHook = @{
    matcher = "compact"
    hooks   = @(
        @{
            type    = "command"
            command = $hookCommand
            timeout = 5
        }
    )
}

if (Test-Path $settingsPath) {
    $json = [System.IO.File]::ReadAllText($settingsPath, $utf8NoBom)
    $settings = ConvertFrom-Json $json

    # 檢查是否已有 compact hook
    $hasCompactHook = $false
    if ($settings.hooks -and $settings.hooks.SessionStart) {
        foreach ($entry in $settings.hooks.SessionStart) {
            if ($entry.matcher -eq "compact") {
                $hasCompactHook = $true
                break
            }
        }
    }

    if ($hasCompactHook) {
        Write-Host "[OK] settings.json 已含 compact hook，跳過"
    }
    else {
        # 追加 compact hook
        if (-not $settings.hooks) {
            $settings | Add-Member -NotePropertyName "hooks" -NotePropertyValue @{} -Force
        }
        if (-not $settings.hooks.SessionStart) {
            $settings.hooks | Add-Member -NotePropertyName "SessionStart" -NotePropertyValue @() -Force
        }

        $sessionStartArray = @($settings.hooks.SessionStart) + @($compactHook)
        $settings.hooks.SessionStart = $sessionStartArray

        $outputJson = ConvertTo-Json -Depth 10 -InputObject $settings
        [System.IO.File]::WriteAllText($settingsPath, $outputJson, $utf8NoBom)
        Write-Host "[OK] settings.json 已追加 compact hook"
    }
}
else {
    $newSettings = @{
        hooks = @{
            SessionStart = @($compactHook)
        }
    }
    $outputJson = ConvertTo-Json -Depth 10 -InputObject $newSettings
    [System.IO.File]::WriteAllText($settingsPath, $outputJson, $utf8NoBom)
    Write-Host "[OK] 已建立 settings.json 並寫入 compact hook"
}

Write-Host ""
Write-Host "初始化完成。CLAUDE.md 和 settings.json 已設定。"
