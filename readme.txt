=== Rad am Ring ===
Contributors: Daniel
Requires at least: 5.0
Requires PHP: 7.4
Tested up to: 6.5
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

24h Bike Race Driver & Lap Tracking Tool

== Description ==

Rad am Ring is a WordPress plugin designed to track drivers and lap times during a 24-hour bike race. It features:

* Race session management with planned start/end times
* Multiple driver tracking with editable planned lap times
* Driver switch tracking with manual second-accurate time corrections
* Queue-based change prognosis with quick edit controls
* Dark theme optimized for outdoor/night use
* Public read-only live dashboard for blog readers
* Real-time statistics, rolling averages, and race-end buffer forecast
* Excel export after a race has ended

== Installation ==

1. Download the plugin folder `rad-am-ring-plugin`
2. Upload it to your WordPress installation: `/wp-content/plugins/`
3. Activate the plugin through the WordPress admin panel
4. Navigate to "Rad am Ring" in the admin menu
5. Create a new race and start tracking!

== Public Dashboard ==

The plugin creates a public read-only dashboard page for blog readers:

`https://your-domain.example/rad-am-ring-live/`

On the live site this is:

`https://www.dgd-racing-team.de/rad-am-ring-live/`

In the local container environment, use the non-pretty WordPress page URL unless
permalinks are enabled:

`http://localhost:8080/?page_id=4`

The page uses the `[rad_am_ring_public]` shortcode and is created automatically on plugin activation. Readers can view the live race dashboard there, but editing remains limited to WordPress admins.

== Quick Start ==

1. **Create a Race**: Enter race name, start/cutoff time, first-lap offset, target offset, and driver names.
2. **Review the Queue**: The forecast shows upcoming stints and can be adjusted quickly with the `-` buttons.
3. **Start or Correct the Race Start**: Before the first switch, the correction field adjusts the race start.
4. **Switch Drivers / Next Lap**: Use the main action button to log a driver change or another lap for the same driver.
5. **Track the Forecast**: Watch current/next driver, change countdown, queue, driver stats, and race-end buffer.

== Features ==

- **Night-Proof UI**: Dark theme with high contrast for outdoor visibility
- **Queue Prognosis**: Forecasts future driver changes through the race cutoff
- **Quick Queue Editing**: Remove upcoming stints directly from the forecast
- **Manual Time Corrections**: Correct race start or driver switch times to the second
- **Multi-Driver Support**: Track unlimited drivers per race
- **Driver Statistics**: Completed laps, remaining projected laps, rolling 3-lap average, and next ride countdown
- **Public Dashboard**: Read-only live view for blog readers
- **Race Export**: Excel export after the race is ended
- **Responsive Design**: Works on desktop, tablet, and mobile devices

== Technical Details ==

The plugin creates the following database tables:
- `wp_rar_race_sessions`: Race events
- `wp_rar_drivers`: Driver information
- `wp_rar_lap_times`: Individual lap records
- `wp_rar_driver_rotations`: Driver switch history

== Requirements ==

- WordPress 5.0+
- PHP 7.4+
- MySQL 5.6+

== Future Enhancements ==

Most originally planned race-management features are now implemented: queue prognosis, first-lap offset, target offset, public dashboard, quick queue editing, dark mode, and export.

Possible future additions:

- [ ] Offline/PWA support for unreliable network conditions
- [ ] More export formats if needed
- [ ] Dedicated mobile app integration

== FAQ ==

**Q: Can I modify the lap time after recording?**
A: Lap timing is inferred from driver switches. You can correct race start and switch times to the second.

**Q: Can multiple people use this simultaneously?**
A: Yes, the AJAX interface supports concurrent usage on a local network.

**Q: Is my data secure?**
A: All AJAX requests require WordPress nonce verification. Only admin users can access race data.

**Q: Can I export the race data?**
A: Yes. End the race and use the Excel export in the admin dashboard.

== Support ==

For issues or feature requests, contact the plugin author.

== Changelog ==

= 0.1.1 =
* Dark mode dashboard and public live view
* Queue-based driver prognosis with quick edit controls
* First-lap and target offsets
* Manual start/switch time correction to the second
* Race deletion fixes and cache-busted assets
* Excel export after race end

= 0.1.0 =
* Initial release
* Basic race tracking functionality
* Driver management
* Driver rotation tracking
