$localPort = 3000
$remotePort = 44111
$borePath = "C:\Users\fogen\.gemini\AIIA\bin\bore.exe"

while ($true) {
    echo "$(Get-Date -Format 'HH:mm:ss') - Starting tunnel on bore.pub:$remotePort..."
    
    # Start bore process
    $proc = Start-Process $borePath -ArgumentList "local $localPort --to bore.pub -p $remotePort" -PassThru -WindowStyle Hidden
    
    # Wait 5 minutes
    Start-Sleep -Seconds 300
    
    # Kill and check if it crashed early (may need to increment port)
    if ($proc.HasExited) {
        echo "Bore exited unexpectedly. Trying next port..."
        $remotePort++
    } else {
        Stop-Process -Id $proc.Id -Force
    }
}
