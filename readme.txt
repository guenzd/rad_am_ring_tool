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

* Race session management
* Multiple driver tracking
* Lap time recording
* Driver rotation tracking
* Dark theme optimized for outdoor/night use
* Real-time statistics and averages
* Simple, intuitive interface

== Installation ==

1. Download the plugin folder `rad-am-ring-plugin`
2. Upload it to your WordPress installation: `/wp-content/plugins/`
3. Activate the plugin through the WordPress admin panel
4. Navigate to "Rad am Ring" in the admin menu
5. Create a new race and start tracking!

== Quick Start ==

1. **Create a Race**: Enter a race name and click "Start New Race"
2. **Add Drivers**: Enter driver names and optional average lap times
3. **Record Laps**: Select the current driver, enter their lap time, and click "RECORD LAP"
4. **Switch Drivers**: Use the "Driver Switch" section to log driver changes
5. **View Statistics**: See real-time driver stats (total laps, average lap time, total time)

== Features ==

- **Night-Proof UI**: Dark theme with high contrast for outdoor visibility
- **Real-Time Updates**: Immediate lap time recording and statistics
- **Multi-Driver Support**: Track unlimited drivers per race
- **Lap History**: Complete history of all driver switches
- **Average Calculation**: Automatic calculation of average lap times
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

- [ ] Lap time prognosis (estimated next driver change)
- [ ] Configurable lap length
- [ ] First lap adjustment (7 minutes shorter)
- [ ] Export race data to CSV/PDF
- [ ] Mobile app integration
- [ ] Real-time forecast of future driver changes

== FAQ ==

**Q: Can I modify the lap time after recording?**
A: Not in this version. You can delete laps and re-record them manually.

**Q: Can multiple people use this simultaneously?**
A: Yes, the AJAX interface supports concurrent usage on a local network.

**Q: Is my data secure?**
A: All AJAX requests require WordPress nonce verification. Only admin users can access race data.

**Q: Can I export the race data?**
A: The data is stored in standard MySQL tables and can be queried directly.

== Support ==

For issues or feature requests, contact the plugin author.

== Changelog ==

= 0.1.0 =
* Initial release
* Basic race tracking functionality
* Driver management
* Lap time recording
* Driver rotation tracking
