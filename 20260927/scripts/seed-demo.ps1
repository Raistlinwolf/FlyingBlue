# Fills the read-only demo account with sample data (6 bookings DEMO01–DEMO06, 15 flights,
# SAF / card / promotion XP, refunds and compensation, one qualification cycle, a TWD rate).
# Signs in as that account through the public API, so RLS applies exactly as in the app.
# Refuses to run when the account already has bookings: delete them in the app first.
#
#   powershell -File scripts/seed-demo.ps1                 # prompts for the password
#   $env:FBXP_DEMO_PASSWORD = '…'; powershell -File scripts/seed-demo.ps1
#
# The password is never stored in this repository.
param(
  [string]$Email = 'dev@example.com',
  [string]$Base = 'https://jczyrhbgqvttqkhcahmk.supabase.co',
  [string]$Key = 'sb_publishable_MjgDfM3Q2eeLOdDlvrggAQ_4qH6OKn3'
)
$ErrorActionPreference = 'Stop'

$password = $env:FBXP_DEMO_PASSWORD
if (-not $password) {
  $secure = Read-Host "Password for $Email" -AsSecureString
  $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$login = Invoke-RestMethod -Method Post -Uri "$Base/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $Key } -ContentType 'application/json' `
  -Body (@{ email = $Email; password = $password } | ConvertTo-Json)
$Uid = $login.user.id
$H = @{ apikey = $Key; Authorization = "Bearer $($login.access_token)" }

function Get-Rows($path) { Invoke-RestMethod -Uri "$Base/rest/v1/$path" -Headers $H }
function Send-Rows($method, $path, $body) {
  $json = ConvertTo-Json -InputObject @($body) -Depth 6
  Invoke-RestMethod -Method $method -Uri "$Base/rest/v1/$path" -Headers ($H + @{ Prefer = 'return=minimal' }) `
    -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

if ((Get-Rows 'bookings?select=id').Count -gt 0) { throw 'The demo account already has bookings; not seeding twice.' }

function NewId { [guid]::NewGuid().ToString() }
$b = @{}; 'lis','nordic','sin','tyo','tpe','bcn' | ForEach-Object { $b[$_] = NewId }

Send-Rows Patch "user_settings?user_id=eq.$Uid" @{
  home_airport = 'AMS'; default_airline = 'KL'; current_status = 'Silver'; xp_target = 180
}

Send-Rows Post 'qualification_cycles' @(@{
  id = NewId; name = 'FB 2026'; start_date = '2026-01-01'; end_date = '2026-12-31'
  starting_status = 'Silver'; target_xp = 180; carried_over_xp = 12; notes = 'Demo: aiming for Gold'
})

Send-Rows Post 'exchange_rates' @(@{ id = NewId; from_currency = 'TWD'; to_currency = 'EUR'; rate = 0.0285; effective_from = '2026-09-01' })

function Bk($key, $name, $ref, $purchase, $cat, $price, $cur, $status, $baseline = $null, $notes = 'Demo data') {
  @{ id = $b[$key]; booking_name = $name; booking_reference = $ref; purchase_date = $purchase; category = $cat
     total_price = $price; currency = $cur; status = $status; baseline_alternative_price = $baseline; notes = $notes }
}
Send-Rows Post 'bookings' @(
  (Bk 'lis'    'Lisbon long weekend'     'DEMO01' '2026-02-02' 'Personal Travel' 286   'EUR' 'Flown'),
  (Bk 'nordic' 'Nordic XP run'           'DEMO02' '2026-04-20' 'XP Run'          412   'EUR' 'Flown' $null 'Demo data: three Business segments in two days'),
  (Bk 'sin'    'Singapore conference'    'DEMO03' '2026-06-01' 'Business Travel' 3480  'EUR' 'Flown' 2950 'Demo data: employer reimburses the Economy fare'),
  (Bk 'tyo'    'Tokyo autumn trip'       'DEMO04' '2026-08-18' 'Personal Travel' 1190  'EUR' 'Booked'),
  (Bk 'tpe'    'Christmas in Taipei'     'DEMO05' '2026-09-20' 'Personal Travel' 34500 'TWD' 'Planned'),
  (Bk 'bcn'    'Barcelona day trip'      'DEMO06' '2026-04-02' 'Personal Travel' 158   'EUR' 'Cancelled')
)

function Seg($key, $pos, $date, $fn, $from, $to, $al, $cabin, $xp, $status) {
  @{ id = NewId; booking_id = $b[$key]; position = $pos; flight_date = $date; flight_number = $fn
     origin_iata = $from; destination_iata = $to; marketing_airline = $al; cabin = $cabin
     expected_xp = $xp; actual_xp = $(if ($status -eq 'Flown') { $xp } else { $null }); segment_status = $status }
}
Send-Rows Post 'flight_segments' @(
  (Seg 'lis'    1 '2026-03-12' 'KL1691' 'AMS' 'LIS' 'KL' 'Economy'         5  'Flown'),
  (Seg 'lis'    2 '2026-03-15' 'KL1692' 'LIS' 'AMS' 'KL' 'Economy'         5  'Flown'),
  (Seg 'nordic' 1 '2026-05-16' 'KL1125' 'AMS' 'CPH' 'KL' 'Business'        15 'Flown'),
  (Seg 'nordic' 2 '2026-05-16' 'SK1706' 'CPH' 'HEL' 'SK' 'Business'        15 'Flown'),
  (Seg 'nordic' 3 '2026-05-17' 'KL1168' 'HEL' 'AMS' 'KL' 'Business'        15 'Flown'),
  (Seg 'sin'    1 '2026-07-06' 'KL835'  'AMS' 'SIN' 'KL' 'Business'        36 'Flown'),
  (Seg 'sin'    2 '2026-07-11' 'KL836'  'SIN' 'AMS' 'KL' 'Business'        36 'Flown'),
  (Seg 'tyo'    1 '2026-10-24' 'AF1241' 'AMS' 'CDG' 'AF' 'Economy'         5  'Booked'),
  (Seg 'tyo'    2 '2026-10-24' 'AF274'  'CDG' 'HND' 'AF' 'Premium Economy' 24 'Booked'),
  (Seg 'tyo'    3 '2026-11-04' 'AF279'  'HND' 'CDG' 'AF' 'Premium Economy' 24 'Booked'),
  (Seg 'tyo'    4 '2026-11-04' 'AF1640' 'CDG' 'AMS' 'AF' 'Economy'         5  'Booked'),
  (Seg 'tpe'    1 '2026-12-19' 'CI74'   'AMS' 'TPE' 'CI' 'Economy'         12 'Planned'),
  (Seg 'tpe'    2 '2027-01-04' 'CI73'   'TPE' 'AMS' 'CI' 'Economy'         12 'Planned'),
  (Seg 'bcn'    1 '2026-04-25' 'KL1673' 'AMS' 'BCN' 'KL' 'Economy'         5  'Cancelled'),
  (Seg 'bcn'    2 '2026-04-25' 'KL1678' 'BCN' 'AMS' 'KL' 'Economy'         5  'Cancelled')
)

function Xp($date, $src, $desc, $cost, $xp, $status, $key = $null) {
  @{ id = NewId; booking_id = $(if ($key) { $b[$key] } else { $null }); transaction_date = $date; source_type = $src
     description = $desc; cost = $cost; currency = 'EUR'; expected_xp = $xp
     actual_xp = $(if ($status -eq 'Credited') { $xp } else { $null }); status = $status; notes = 'Demo data' }
}
Send-Rows Post 'xp_transactions' @(
  (Xp '2026-03-01' 'Credit Card' 'Flying Blue credit card: annual XP bonus' 175 20 'Credited'),
  (Xp '2026-07-06' 'SAF'         'SAF contribution on Singapore trip'       96  16 'Credited' 'sin'),
  (Xp '2026-09-10' 'Promotion'   'Autumn XP promotion'                      0   10 'Pending'),
  (Xp '2026-10-24' 'SAF'         'SAF contribution on Tokyo trip'           60  10 'Planned' 'tyo')
)

function Cr($date, $type, $desc, $amount, $key) {
  @{ id = NewId; booking_id = $b[$key]; transaction_date = $date; credit_type = $type; description = $desc
     amount = $amount; currency = 'EUR'; include_in_net_cost = $true; notes = 'Demo data' }
}
Send-Rows Post 'credits' @(
  (Cr '2026-04-08' 'EC261 Compensation'    'KL1692 delayed 3h40'              400  'lis'),
  (Cr '2026-05-02' 'Ticket Refund'         'Refund for cancelled day trip'    158  'bcn'),
  (Cr '2026-07-25' 'Expense Reimbursement' 'Employer reimbursed Economy fare' 2950 'sin')
)

foreach ($t in 'bookings','flight_segments','xp_transactions','credits','qualification_cycles','exchange_rates') { "$t $((Get-Rows "$($t)?select=id").Count)" }
