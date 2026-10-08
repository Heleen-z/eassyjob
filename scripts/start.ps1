$ErrorActionPreference = 'Stop'
$appId = 'job-application-library'
$appUrl = 'http://127.0.0.1:4173'
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverFile = Join-Path $PSScriptRoot 'local-server.mjs'
$runtimeDirectory = Join-Path $projectDirectory '.runtime'
$pidFile = Join-Path $runtimeDirectory 'server.pid'

function Get-AppHealth {
    try {
        $response = Invoke-WebRequest -Uri ($appUrl + '/health') -UseBasicParsing -TimeoutSec 1
        return ($response.Content | ConvertFrom-Json)
    } catch { return $null }
}

function Test-AppPort {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $attempt = $client.BeginConnect('127.0.0.1', 4173, $null, $null)
        if (-not $attempt.AsyncWaitHandle.WaitOne(250)) { return $false }
        $client.EndConnect($attempt)
        return $client.Connected
    } catch { return $false }
    finally { $client.Dispose() }
}

try {
    $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $nodeCommand -or -not (Test-Path -LiteralPath $nodeCommand.Source -PathType Leaf)) {
        throw '未找到 Node.js，请安装 20 或更高版本后重试。'
    }
    $nodeVersionText = & $nodeCommand.Source --version
    if ($LASTEXITCODE -ne 0 -or [string]$nodeVersionText -notmatch '^v(\d+)\.') {
        throw '无法确认 Node.js 版本，请检查安装后重试。'
    }
    if ([int]$Matches[1] -lt 20) { throw '当前 Node.js 版本过低，请升级到 20 或更高版本。' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'dist\client\index.html') -PathType Leaf)) {
        throw '缺少应用构建文件，请在应用目录依次运行 npm install 和 npm run build。'
    }
    $existing = Get-AppHealth
    if ($existing -and $existing.app -eq $appId -and $existing.pid -is [ValueType]) {
        Start-Process -FilePath $appUrl
        Write-Host '应用已在运行，已在浏览器中打开。'
        exit 0
    }
    if (Test-AppPort) { throw '4173 端口被其他服务占用，请关闭该服务后重试。应用地址不会自动更改。' }
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $serverProcess = Start-Process -FilePath $nodeCommand.Source `
        -ArgumentList ('"' + $serverFile + '"') `
        -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') `
        -RedirectStandardError (Join-Path $runtimeDirectory 'server.error.log')
    [IO.File]::WriteAllText($pidFile, [string]$serverProcess.Id)
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
        $health = Get-AppHealth
        if ($health -and $health.app -eq $appId -and $health.pid -eq $serverProcess.Id) {
            Start-Process -FilePath $appUrl
            Write-Host ('应用已启动：' + $appUrl)
            Write-Host ('日志位置：' + $runtimeDirectory)
            exit 0
        }
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) { throw ('本地服务已退出，请查看：' + (Join-Path $runtimeDirectory 'server.error.log')) }
        Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $deadline)
    throw ('应用未在 5 秒内就绪，请查看日志：' + $runtimeDirectory)
} catch {
    Write-Host ('启动失败：' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
