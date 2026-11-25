[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateRange(1024, 65535)][int]$Port = 3000,
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$taskPrincipal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $WhatIfPreference -and -not $taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator, change to this repository, then run .\scripts\allow-phone-dev.ps1. This adds one local-network rule; it does not disable Windows Firewall.'
}

$taskRuleName = "August-Phone-Development-$Port"
if ($Remove) {
    if ($PSCmdlet.ShouldProcess($taskRuleName, 'Remove the August development firewall rule')) {
        Get-NetFirewallRule -Name $taskRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    }
    return
}

$taskNodePath = (Get-Command node -CommandType Application).Source
if ($PSCmdlet.ShouldProcess("$taskNodePath on TCP $Port, local subnet only", 'Allow phone access to the development backend')) {
    Get-NetFirewallRule -Name $taskRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -Name $taskRuleName -DisplayName "August phone development ($Port, local subnet)" `
        -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -RemoteAddress LocalSubnet `
        -Program $taskNodePath -Profile Any -EdgeTraversalPolicy Block | Out-Null
    Write-Output "Allowed local-network access to Node.js on TCP $Port. Keep npm run dev:lan running."
    Write-Output "To remove this rule later: .\scripts\allow-phone-dev.ps1 -Port $Port -Remove"
}
