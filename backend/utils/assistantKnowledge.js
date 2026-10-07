// The trade know-how the storefront assistant answers from, the way a master technician would:
// sizing rules, what a symptom usually means, what a job really needs, and where DIY stops. It
// goes into the system prompt (utils/assistantChat.js) as rules of thumb for the Philippines — the
// catalog, prices and HomeLink's policies never come from here, only from the assistant's
// functions and store information. Edit it like a handbook: add what your technicians find
// themselves explaining to customers, then check the effect with `npm run eval:assistant`.
export const FIELD_GUIDE = `
AIR CONDITIONING
- Size by floor area (length × width): up to 10 sqm → 0.75 HP; 10–15 sqm → 1.0 HP; 15–20 sqm → 1.5 HP; 20–30 sqm → 2.0 HP; 30–40 sqm → 2.5 HP; 40–50 sqm → 3.0 HP. Large open areas, offices and shops → ceiling cassette or floor-standing units (3 HP and up).
- Go one size up for: west-facing or afternoon sun, a top floor or room right under the roof, a kitchen, 3+ people in the room, lots of glass, or a ceiling over 3 m. A room at the top of a range with any of these needs the next size.
- An undersized unit runs nonstop and never gets the room cold; an oversized non-inverter cycles on and off and leaves the room clammy.
- Capacity is labelled in HP or BTU/h; roughly 1 HP ≈ 9,000 BTU/h.
- Inverter vs non-inverter: inverters cost more upfront but use roughly 30–50% less electricity when run for long hours (overnight, all day). For a few hours a day or a tight budget, a non-inverter or window-type is fine.
- Window-type: cheapest and simplest, needs a wall opening, louder. Split-type: quiet, needs professional installation with copper piping to an outdoor unit.
- Every aircon needs its own dedicated circuit and breaker with wire sized for it (the unit's manual lists it; typically 3.5 mm² wire on a 20 A breaker up to 1.5 HP, 5.5 mm² on 30 A for 2 HP and up). Never share an aircon's circuit with other big appliances.
- Maintenance: rinse the filters every 2–4 weeks; professional cleaning every 3–6 months (sooner in dusty areas or heavy use).
- Not cooling, in order of likelihood: dirty filters or coil → wrong mode or setting (use Cool at 24–25°C) → outdoor unit blocked or its fan not spinning → low refrigerant from a leak (ice on the pipes, weak airflow that stays warm) → failing capacitor or compressor (outdoor unit silent or clicking). The customer can check the first three; refrigerant, electrical parts and the compressor are for a technician.
- Water dripping indoors: clogged drain line or dirty unit → cleaning. Bad smell: mould in the coil → cleaning.
- Running cost: kW × hours × the rate on their bill (Metro Manila is roughly ₱12/kWh but changes monthly). A 1.5 HP inverter draws roughly 0.6–1.2 kW once the room is cool.

SOLAR
- Size from monthly kWh on the electric bill. Only have the peso amount? kWh ≈ bill ÷ ~₱12.
- In the Philippines, 1 kWp of panels makes about 120 kWh a month (about 4 peak sun hours a day). Full offset ≈ monthly kWh ÷ 120 kWp. Without batteries, solar only covers daytime use, so most homes size for their daytime load (often half to two-thirds of the bill).
- Panel count = kWp × 1,000 ÷ panel watts (200 W → 5 panels per kWp; 400 W → 2.5 per kWp). Roof space: about 5–6 sqm per kWp of unshaded, ideally south-facing roof.
- System types: grid-tied (cheapest, but shuts down in a brownout for safety); hybrid (grid plus batteries — keeps power on in brownouts and runs at night); off-grid (no utility at all, needs the biggest battery bank).
- A full system is panels + inverter (about the same kW as the panel array) + mounting, cabling and protection, + batteries for hybrid or off-grid, + professional installation. One panel alone powers almost nothing in a home.
- Batteries are sized in kWh of storage: enough for the night-time and brownout load they must carry. 48 V lithium (LiFePO4) banks are the usual choice for home hybrid systems.
- Sending excess power to the grid needs net-metering approval from the utility (e.g. Meralco) and a bidirectional meter.
- Maintenance: clean panels 2–4 times a year (more in dusty or coastal areas) and check the inverter app for drops in output. Roof work is for technicians.

CCTV AND SECURITY
- Cover every entry point first (front gate, front and back doors, garage, side paths), then common areas. A typical house needs 4 cameras; a two-storey house with a yard, 4–8.
- Wired kits (DVR/NVR recorder + cameras + hard drive): best for houses and perimeters, keep recording when the internet is down, need cable runs → professional installation.
- Wi-Fi cameras: best for condos, indoors or one or two spots; record to a microSD card or the cloud, need strong Wi-Fi and a power outlet at each spot; usually DIY-friendly.
- 2MP (1080p) shows what happened; to identify faces or plate numbers at a distance, use 4MP+ or put the camera closer. Outdoor cameras need an IP66/IP67 weather rating and night vision.
- Storage: four 2MP cameras recording around the clock fill roughly 1 TB every 2–3 weeks; motion-only recording lasts far longer. Choose a recorder with spare channels if more cameras may come later.
- Hide the recorder (a thief can take it with the footage) and put it on a UPS so brownouts don't stop recording.
- Smart locks: check the door's thickness and lock type before buying; look for a backup way in (mechanical key or emergency USB/9 V power); batteries last about 6–12 months. Mortise locks need a technician to fit.

ELECTRICAL
- Breaker trips when two big appliances run together → that circuit is overloaded. For now, run them on different circuits; the lasting fix is giving the aircon its own dedicated circuit (an electrician's job). Never fit a bigger breaker on the same wire — the wire overheats and that is how house fires start.
- Aircons, microwaves, heaters, refrigerators and other big appliances plug straight into a wall outlet, never an extension cord or power strip. A surge protector guards electronics; it does nothing for an overload.
- Breaker trips the moment it's switched on, even with everything unplugged → likely a short circuit or ground fault. Leave it off and have an electrician trace it.
- Typical home wiring: 2.0 mm² for lighting (15 A breaker), 3.5 mm² for outlets (20 A), 5.5 mm² for aircons, water heaters and ranges (30 A).
- Instant water heaters (3.5–6 kW) need a dedicated circuit, a proper ground wire and ideally a residual-current (ELCB/RCD) breaker.
- Flickering lights: a failing LED bulb or driver → a loose connection at the fixture or switch → a loaded circuit (dims when a big appliance starts). Flicker in many rooms at once may be the main connection or the utility's supply.
- Stop and switch off at the main breaker for: a burning smell, sparks, a warm or discoloured outlet or switch, buzzing from the panel, or water near wiring. Work inside the panel or on live wiring is for a licensed electrician only.
- Surge protectors guard TVs, computers and routers against spikes when power returns after a brownout.

PLUMBING
- Weak pressure upstairs: first clean the showerhead or faucet aerator (soak in vinegar) and make sure the valves are fully open. If the whole floor is weak, the fix is a booster pump with a pressure tank (1 HP typically serves a two-storey home). Many water utilities (e.g. Maynilad, Manila Water) don't allow pumping straight from the main line, so the standard setup is a storage tank feeding the pump — have a plumber set it up.
- Leaks: shut the main valve first; if water is near outlets or wiring, switch that circuit off too. A higher-than-usual water bill with every faucet closed often means a hidden leak or a running toilet.
- Running toilet: usually a worn flapper or fill valve — cheap parts, quick fix.
- Water heaters: single-point instant heaters suit one shower; multi-point or storage heaters serve several taps.

LIGHTING
- Colour temperature: 3000K warm white for bedrooms and living rooms, 4000K neutral for kitchens and dining, 6500K daylight for work areas and garages. Compare brightness in lumens, not watts.
- LEDs use about 80% less power than incandescent bulbs and last years longer. Outdoor fixtures need IP65 or better.

HOME UPKEEP
- A yearly whole-house check (electrical, plumbing, roof and gutters before the rainy season, June to November) catches small problems while they are cheap. Termite damage, cracked walls and sagging ceilings call for an inspection, not a DIY patch.
`.trim();
