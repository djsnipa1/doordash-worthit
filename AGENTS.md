# AGENTS.md - JavaScript Reference Codebase

## Project Overview

- **Purpose**: Reference codebase containing JavaScript from an existing delivery trip analyzer site - used for cherry-picking patterns, techniques, and code snippets for new projects
- **Original Context**: Delivery driver trip profitability analyzer web application
- **Language**: JavaScript (ES6+)
- **Key Patterns**: Vanilla JavaScript with Tailwind CSS, Chart.js integration, form handling with reCAPTCHA, localStorage patterns
- **Use Case**: Extract and adapt useful patterns for new development projects

## What This Workspace Contains

- `main.js` - Complete JavaScript implementation from the reference site
- `clipboard0-0.txt` - Backup copy of the same JavaScript code

**Note**: This is NOT an active project to modify. It's a reference library for copying useful patterns into new projects.

## Useful Patterns Available in This Reference Code

The JavaScript contains reusable patterns organized into functional areas:

1. **Core Business Logic** (`analyzeTrip()`) - Lines 64-283
   - Input validation and clamping
   - API communication patterns
   - Multi-view updates (desktop/mobile)
   
2. **Data Visualization** (`updateChart()`, `updateBreakdownChart()`) - Lines 286-348
   - Chart.js integration patterns
   - Responsive chart configuration
   - Chart instance cleanup
   
3. **Data Persistence** (Trip Log) - Lines 473-659
   - localStorage CRUD operations
   - Client-side filtering and sorting
   - CSV export functionality
   
4. **Form Handling** (Newsletter, Feedback) - Lines 366-470
   - reCAPTCHA v3 integration
   - Form validation patterns
   - Async form submission
   
5. **Share/Social Features** - Lines 725-730, 656-710
   - URL-based data sharing
   - Clipboard API with fallback
   - Social media integration
   
6. **Initialization & Setup** - Lines 942-1062
   - Theme persistence
   - Progressive onboarding tips
   - URL parameter handling

## API Communication Patterns (Reference)

The original code demonstrates REST API patterns:

- `POST /api/analyzeTrip` - Main calculation endpoint with JSON payload
- `POST /api/forms` - Form submission with reCAPTCHA token
- `GET /api/gas_price` - External data fetching pattern
- `POST /api/share` - Create shareable resource, returns ID
- `GET /api/share/:id` - Retrieve shared resource by ID

**Useful Pattern**: See lines 108-278 for comprehensive fetch error handling and multi-step UI updates

## Trip Analysis Calculation Logic (Reverse-Engineered)

### Input Parameters

```javascript
{
  deliveryOffer: 10,           // Dollar amount offered
  time: 5,                      // Time in minutes
  tripDistance: 6,              // Distance in miles
  gasPricePerGallon: 3.06,     // Current gas price
  mpg: 25,                      // Vehicle fuel efficiency
  outOfWayDelay: 0,            // Additional time (minutes)
  waitTime: 0,                  // Wait time (minutes)
  wearCostPerMile: 0.1043,     // Vehicle wear per mile
  preferredHourlyRate: 15      // Driver's minimum acceptable rate
}
```

### Calculation Formulas

#### 1. Gallons Consumed
```javascript
gallons = tripDistance / mpg
// Example: 6 / 25 = 0.24 gallons
```

#### 2. Gas Cost
```javascript
gasCost = gallons * gasPricePerGallon
// Example: 0.24 * 3.06 = $0.7344
```

#### 3. Wear and Tear Cost
```javascript
wearCost = tripDistance * wearCostPerMile
// Example: 6 * 0.1043 = $0.6258
```

#### 4. Total Costs
```javascript
totalCosts = gasCost + wearCost
// Example: 0.7344 + 0.6258 = $1.3602
```

#### 5. Profit
```javascript
profit = deliveryOffer - totalCosts
// Example: 10 - 1.3602 = $8.6398
```

#### 6. Effective Hourly Wage
```javascript
totalTime = time + outOfWayDelay + waitTime
effectiveHourlyWage = (profit / totalTime) * 60
// Example: (8.6398 / 5) * 60 = $103.6776/hour
```

#### 7. Money Per Distance (mpd)
```javascript
mpd = deliveryOffer / tripDistance
// Example: 10 / 6 = $1.6667/mile
```

#### 8. Dollars Per Minute
```javascript
dollarsPerMinute = profit / totalTime
// Example: 8.6398 / 5 = $1.7280/minute
```

#### 9. Mileage Deduction (IRS Standard)
```javascript
deduction = tripDistance * 0.70  // 2024 IRS rate: $0.70/mile
// Example: 6 * 0.70 = $4.20
```

### Verdict Logic

The trip verdict is determined primarily by comparing the **effective hourly wage** to the **preferred hourly rate**:

```javascript
if (effectiveHourlyWage >= preferredHourlyRate) {
  verdict = {
    msg: "✅ Accept this trip!",
    class: "success"
  };
} else if (effectiveHourlyWage >= preferredHourlyRate * 0.75) {
  verdict = {
    msg: "⚠️ Borderline - Consider it",
    class: "warning"
  };
} else {
  verdict = {
    msg: "❌ Reject - Not worth it",
    class: "danger"
  };
}
```

**Key Threshold**: The trip is worth accepting if the effective hourly wage meets or exceeds the driver's preferred hourly rate.

### Complete Calculation Function (Client-Side)

```javascript
function analyzeTrip(params) {
  const {
    deliveryOffer,
    time,
    tripDistance,
    gasPricePerGallon,
    mpg,
    outOfWayDelay = 0,
    waitTime = 0,
    wearCostPerMile = 0.1043,
    preferredHourlyRate = 20
  } = params;
  
  // Calculate costs
  const gallons = tripDistance / mpg;
  const gasCost = gallons * gasPricePerGallon;
  const wearCost = tripDistance * wearCostPerMile;
  const totalCosts = gasCost + wearCost;
  
  // Calculate profit and rates
  const profit = deliveryOffer - totalCosts;
  const totalTime = time + outOfWayDelay + waitTime;
  const effectiveHourlyWage = (profit / totalTime) * 60;
  const mpd = deliveryOffer / tripDistance;
  const dollarsPerMinute = profit / totalTime;
  const deduction = tripDistance * 0.70; // IRS standard mileage rate
  
  // Determine verdict
  let verdict;
  if (effectiveHourlyWage >= preferredHourlyRate) {
    verdict = { msg: "✅ Accept this trip!", class: "success" };
  } else if (effectiveHourlyWage >= preferredHourlyRate * 0.75) {
    verdict = { msg: "⚠️ Borderline - Consider it", class: "warning" };
  } else {
    verdict = { msg: "❌ Reject - Not worth it", class: "danger" };
  }
  
  return {
    deliveryOffer,
    totalTime,
    totalMiles: tripDistance,
    gallons: parseFloat(gallons.toFixed(2)),
    gasCost: parseFloat(gasCost.toFixed(2)),
    wearCost: parseFloat(wearCost.toFixed(2)),
    totalCosts: parseFloat(totalCosts.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    effectiveHourlyWage: parseFloat(effectiveHourlyWage.toFixed(2)),
    mpd: parseFloat(mpd.toFixed(2)),
    dollarsPerMinute: parseFloat(dollarsPerMinute.toFixed(2)),
    deduction: parseFloat(deduction.toFixed(2)),
    verdict
  };
}
```

### Example Usage

```javascript
const result = analyzeTrip({
  deliveryOffer: 10,
  time: 5,
  tripDistance: 6,
  gasPricePerGallon: 3.06,
  mpg: 25,
  wearCostPerMile: 0.1043,
  preferredHourlyRate: 15
});

console.log(result);
// Output: effectiveHourlyWage: 103.68, verdict: "✅ Accept this trip!"
```

## Reusable Code Patterns to Extract

### Helper Functions (Lines 8-18)

- **DOM Selection Helper**: `const $ = (id) => document.getElementById(id)` - Simple, clean DOM access
- **Safe Number Formatting**: `safeFixed(val, decimals, fallback)` - Prevents NaN display issues
- **Text Update Helper**: `setText(id, text)` - Safe element text updates with null checking

### Toast Notification System (Lines 20-61)

**Pattern**: Tailwind-based toast notifications with animations
- Auto-dismiss after 4 seconds
- Prevents duplicate messages
- Color-coded by type (success, error, warning, info)
- Uses `requestAnimationFrame` for smooth animations
- **Copy from**: Lines 20-61

### Input Validation & Clamping (Lines 70-80)

**Pattern**: Clamp user inputs to safe ranges and push back to form
```javascript
deliveryOffer = Math.min(Math.max(deliveryOffer || 0, 1), 500);
$("deliveryOffer").value = deliveryOffer;
```
**Why useful**: Prevents edge cases without blocking user input

### Chart.js Integration (Lines 286-348)

**Pattern**: Proper chart instance management
- Destroy old instances before creating new ones (prevents memory leaks)
- Responsive configuration
- Dynamic positioning based on screen size
- **Copy from**: Lines 286-348

### localStorage CRUD Patterns (Lines 473-659)

**Pattern**: Complete client-side data persistence
- Save with deduplication (lines 473-486)
- Render with filtering (lines 488-521)
- Sort by any column (lines 553-572)
- Export to CSV (lines 574-587)
- Clear with undo (lines 589-650)

### Form Handling with reCAPTCHA (Lines 366-470)

**Pattern**: Async form submission with bot protection
- Disable submit button during processing
- reCAPTCHA v3 integration (invisible)
- Error handling with user feedback
- **Copy from**: Lines 366-470

### Theme Persistence (Lines 350-358, 944-945)

**Pattern**: Dark mode toggle with localStorage
```javascript
root.classList.toggle("dark");
localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light");
```

### Clipboard API with Fallback (Lines 756-778)

**Pattern**: Modern clipboard API with legacy fallback for Safari/older browsers
- Try `navigator.clipboard.writeText()` first
- Fall back to `document.execCommand("copy")` if needed
- **Copy from**: Lines 756-778

### URL Parameter Handling (Lines 862-895)

**Pattern**: Parse URL path segments and preload form data
- Handles `/share/:id` pattern
- Fetches data from API using ID
- Maps shortened parameter names to full form IDs
- **Copy from**: Lines 862-895

### CSV Export (Lines 574-587)

**Pattern**: Client-side data export to CSV
```javascript
const rows = [["Header1", "Header2"]];
data.forEach(item => rows.push([item.field1, item.field2]));
const csv = rows.map(r => r.join(",")).join("\n");
const blob = new Blob([csv], { type: "text/csv" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "filename.csv";
a.click();
```

### Progressive Onboarding Tips (Lines 1022-1031)

**Pattern**: Show tips once per session using localStorage counter
- Checks counter: `+localStorage.getItem("tipsShown") || 0`
- Displays tip based on counter value
- Increments counter after display
- Stops after max tips shown

### Social Media Sharing (Lines 782-798)

**Pattern**: Generate and open platform-specific share URLs
- Twitter: `twitter.com/intent/tweet?url=...&text=...`
- Facebook: `facebook.com/sharer/sharer.php?u=...`
- Reddit: `reddit.com/submit?url=...&title=...`
- Opens in popup window

## Quick Reference: Common Snippets

### Safe DOM Access Pattern
```javascript
const el = $("elementId");
if (el) {
  // Operate on element safely
}
```

### Fetch with Error Handling
```javascript
fetch("/api/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      showToast("❌ " + data.error);
      return;
    }
    // Process success
  })
  .catch(err => showToast("❌ Error: " + err.message));
```

### localStorage with Fallback
```javascript
const data = JSON.parse(localStorage.getItem("key") || "[]");
```

### Optional Chaining for Safety
```javascript
const value = data?.nested?.property || "default";
```

## Best Practices Demonstrated

### Input Handling
- Always clamp numerical inputs to safe ranges
- Push clamped values back to form inputs
- Validate before API calls
- Use optional chaining (`?.`) for safe property access

### Performance
- Destroy chart instances before creating new ones (prevents memory leaks)
- Client-side filtering/sorting (no backend calls)
- Auto-dismiss UI elements (toasts, modals)
- Prevent duplicate toast messages

### User Experience
- Disable submit buttons during processing
- Show loading states
- Provide undo functionality for destructive actions
- Progressive disclosure of advanced features
- Responsive design (mobile-first)

### Security
- Input validation and clamping
- reCAPTCHA v3 for form protection
- Use `textContent` instead of `innerHTML` where possible
- No sensitive data in localStorage

### Browser Compatibility
- Clipboard API with `execCommand` fallback
- Modern ES6+ with graceful degradation
- Responsive chart positioning based on screen size

## Architecture Notes from Reference Code

### Code Organization Pattern
```
// -------- Section Name --------
(Functions and logic grouped by feature)
```

### Global State (Lines 1-6)
- Minimal globals for sorting state and chart instances
- Most state in localStorage or session-only variables

### Initialization Pattern (Lines 942-1062)
1. Restore user preferences (theme, rates)
2. Check URL parameters for data preloading
3. Set defaults only if no preload data
4. Fetch external data (gas prices)
5. Render persisted data (trip log)
6. Setup event listeners
7. Show onboarding elements (tips, quotes)
