// Level 1: finish the daughter's bike. Steps and parts are plain data so later levels
// can be new files instead of new code.
export const level = {
  id: 'bike-1',
  title: "Finish the bike",
  frontTeeth: 32,
  rearTeeth: 16,
  parts: [
    { id: 'crankset', label: 'big gear', needs: [] },
    { id: 'rearCog', label: 'little gear', needs: [] },
    { id: 'pedalR', label: 'pedal', needs: ['crankset'] },
    { id: 'pedalL', label: 'pedal', needs: ['crankset'] },
    { id: 'chain', label: 'chain', needs: ['crankset', 'rearCog'] },
    { id: 'guard', label: 'chain guard', needs: ['chain'] },
  ],
  steps: [
    { id: 'open', label: 'Toolbox', say: 'Tap both latches to open the toolbox.', gesture: 'tap' },
    { id: 'crankset', label: 'Big gear', say: 'Drag the big gear onto the middle of the bike.', gesture: 'drag' },
    { id: 'rearCog', label: 'Little gear', say: 'Now the little gear goes on the back wheel.', gesture: 'drag' },
    { id: 'pedals', label: 'Pedals', say: 'Pop a pedal onto each pedal arm.', gesture: 'drag' },
    { id: 'chain', label: 'Chain', say: 'Drag the chain over. It loops around both gears.', gesture: 'drag' },
    {
      id: 'guard',
      label: 'Guard',
      say: 'The teal chain guard is inside the lid. Drag it onto the chain.',
      gesture: 'drag',
      showNow: true,
    },
    { id: 'screws', label: 'Screws', say: 'Tap the orange screwdriver in the toolbox.', gesture: 'tap', showNow: true },
    { id: 'test', label: 'Test', say: 'Turn a pedal around to test it!', gesture: 'turn', showNow: true },
  ],
};
