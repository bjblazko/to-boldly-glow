// Columbia: Apollo 11's command and service module, outside and in. Figures from North American
// Rockwell's "Apollo Spacecraft News Reference" for NASA (1968); the cabin as it flew is Project
// Apollo - NASSP's cockpit, as it is today the Smithsonian's scan of the real Columbia.

export const columbia = {
  title: 'Columbia, Inside and Out',
  note:
    'The outside is built from the spacecraft’s published dimensions; the service module’s inside is ' +
    'shown schematically. The cabin as it flew is Project Apollo - NASSP’s model of it, switch by switch; ' +
    'as it is today, the Smithsonian’s 3D scan of the real Columbia in the National Air and Space Museum.',
  chapters: {
    whole: {
      title: 'The Spacecraft',
      text:
        'Apollo 11’s spacecraft had two parts: the command module Columbia, home to the three ' +
        'astronauts, and the service module behind it with the main engine, propellant, oxygen and power. ' +
        'Together they flew to the Moon and back; only the command module returned to Earth.',
    },
    serviceModule: {
      title: 'The Service Module, Cut Open',
      text:
        'Six wedge-shaped sectors surround the main engine. Two hold the oxidizer, two the fuel, each in a ' +
        'sump tank and a storage tank; helium in the middle pushes the propellants to the engine. One ' +
        'sector holds three fuel cells and the tanks of oxygen and hydrogen they turn into electricity. ' +
        'About three quarters of the module’s weight is propellant.',
    },
    engine: {
      title: 'The Engine That Had to Work',
      text:
        'The service propulsion engine pushes with about 89 kilonewtons and can be restarted. It braked ' +
        'Apollo 11 into orbit around the Moon and, after the landing, sent Columbia home. There was no ' +
        'second engine to fall back on.',
    },
    commandModule: {
      title: 'The Command Module',
      text:
        'A cone 3.2 m tall and 3.9 m across. Under its skin lies the heat shield: steel honeycomb covered ' +
        'with a phenolic epoxy resin that charred and fell away as the capsule came back through the ' +
        'atmosphere. Five windows, a side hatch and, at the top, the tunnel to the lunar module.',
    },
    inside: {
      title: 'Inside',
      text:
        'This is the cabin as it flew, rebuilt switch by switch by Project Apollo - NASSP. It offered about 6 ' +
        'cubic metres of room - for three men and eight days, the whole way to the Moon and back.',
    },
    panels: {
      title: 'The Main Display Console',
      text:
        'Above the couches arches the main display console: switches, gauges and warning lights for every ' +
        'system on board, and the keyboard of the guidance computer. The commander sat on the left, the ' +
        'command module pilot in the middle, the lunar module pilot on the right.',
    },
    seats: {
      title: 'Three Couches',
      text:
        'The three couches stand on crushable honeycomb struts that softened the blow when the capsule hit ' +
        'the water. At their foot lies the lower equipment bay with the navigation instruments: a sextant, ' +
        'a telescope and the guidance computer with its keyboard.',
    },
    today: {
      title: 'Columbia Today',
      text:
        'The real Columbia is in the National Air and Space Museum in Washington. The Smithsonian scanned ' +
        'its cabin and photographed it all over: this is that scan, the cabin as it is now - the couches ' +
        'worn, the colours faded, as the capsule came home.',
    },
    notes: {
      title: 'Notes on the Walls',
      text:
        'Handwritten numbers and notes cover parts of Columbia’s walls. Michael Collins flew her alone ' +
        'around the Moon while Armstrong and Aldrin walked on its surface. The scan keeps every line, ' +
        'just as the capsule came home.',
    },
  },
  parts: {
    cm: 'Command module',
    sm: 'Service module',
    smInside: 'Tanks and fuel cells',
    sps: 'Main engine',
    rcs: 'Steering thrusters',
    antenna: 'High-gain antenna',
    person: 'A person (1.8 m)',
    hull: 'Cabin wall',
    panels: 'Main display console',
    seats: 'Couches',
    notes: 'Crew notes',
    vcCabin: 'Cabin wall',
    vcPanels: 'Main display console',
    vcHatches: 'Hatches',
    vcCouches: 'Couches',
  },
  marks: {
    sm: { label: 'Top of the service module' },
    cm: { label: 'Top of the command module' },
  } as Record<string, { label: string; note?: string }>,
  captions: {
    splashdown: 'Columbia in the Pacific after splashdown, 24 July 1969, the crew in the raft beside it.',
    hornet: 'Columbia aboard the USS Hornet, its heat shield charred by re-entry; beside it the quarantine trailer.',
    simulator: 'Michael Collins training in the command module simulator, June 1969.',
  },
  facts: {
    cmHeight: { label: 'Command module', value: '3.2 m tall' },
    diameter: { label: 'Diameter', value: '3.9 m' },
    smMass: { label: 'Service module, fuelled', value: 'about 25 t' },
    propellant: { label: 'Share of propellant', value: 'about 75 %' },
    thrust: { label: 'Main engine', value: 'about 89 kN' },
    room: { label: 'Room inside', value: 'about 6 m³' },
    crew: { label: 'Crew', value: '3' },
  },
}
