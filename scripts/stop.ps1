$ErrorActionPreference = 'Stop'
$appId = 'job-application-library'
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'local-server.mjs'))
$runtimeDirectory = Join-Path $projectDirectory '.runtime'
$pidFile = Join-Path $runtimeDirectory 'server.pid'

try {
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/health' -UseBasicParsing -TimeoutSec 1
        $health = $response.Content | ConvertFrom-Json
    } catch {
        Write-Host '本地应用未响应，没有停止任何进程。'
        exit 0
    }
    if ($health.app -ne $appId) { throw '4173 端口属于其他服务，没有停止任何进程。' }
    if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) { throw '缺少应用进程记录，没有停止任何进程。' }
    $recordedPid = 0
    if (-not [int]::TryParse([IO.File]::ReadAllText($pidFile).Trim(), [ref]$recordedPid) -or $recordedPid -le 0) {
        throw '应用进程记录无效，没有停止任何进程。'
    }
    if ($health.pid -ne $recordedPid) { throw '服务进程与保存的进程记录不一致，没有停止任何进程。' }
    $candidateProcess = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + $recordedPid)
    $exactScriptPattern = '(?i)(?:^|\s|\")' + [regex]::Escape($serverFile) + '(?:\"|\s|$)'
    if (-not $candidateProcess -or $candidateProcess.Name -ne 'node.exe' -or $candidateProcess.CommandLine -notmatch $exactScriptPattern) {
        throw '该进程不属于此应用，没有停止任何进程。'
    }
    # Retain a handle to the verified process, so cached enumeration or PID reuse
    # cannot make an already-exited process look as though it is still running.
    $targetProcess = Get-Process -Id $recordedPid -ErrorAction Stop
    $null = $targetProcess.Handle
    try {
        Stop-Process -Id $recordedPid -Force -ErrorAction Stop
        $exited = $targetProcess.WaitForExit(3000)
        $targetProcess.Refresh()
        if (-not $exited -and -not $targetProcess.HasExited) { throw '应用进程尚未退出。' }
    } finally { $targetProcess.Dispose() }
    Remove-Item -LiteralPath $pidFile -Force
    Add-Content -LiteralPath (Join-Path $runtimeDirectory 'launcher.log') -Encoding UTF8 -Value ([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss') + ' 已停止进程 ' + $recordedPid)
    Write-Host '应用已停止，浏览器中的资料仍然保留。'
    Write-Host ('日志位置：' + $runtimeDirectory)
    exit 0
} catch {
    Write-Host ('停止失败：' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
