const relationships = Object.freeze({
  'orbit-speed': {
    math: '<mi>v</mi><mo>=</mo><msqrt><mfrac><mrow><mi>G</mi><mi>M</mi></mrow><mi>r</mi></mfrac></msqrt>',
    label: 'Circular speed equals the square root of G times star mass divided by distance.',
    symbols: 'v: circular speed · G: gravity constant · M: star mass · r: distance from the star'
  },
  'moon-mass': {
    math: '<msub><mi>r</mi><mi>b</mi></msub><mo>=</mo><mi>d</mi><mo>×</mo><mfrac><msub><mi>m</mi><mi>M</mi></msub><mrow><msub><mi>m</mi><mi>E</mi></msub><mo>+</mo><msub><mi>m</mi><mi>M</mi></msub></mrow></mfrac>',
    label: 'Balance point distance equals Earth Moon separation times Moon mass divided by their combined mass.',
    symbols: 'rᵦ: balance point from Earth · d: Earth–Moon distance · mM: Moon mass · mE: Earth mass'
  },
  'collision-speed': {
    math: '<mi>E</mi><mo>=</mo><mfrac><mn>1</mn><mn>2</mn></mfrac><mi>μ</mi><msup><mi>v</mi><mn>2</mn></msup>',
    label: 'Relative kinetic energy equals one half times reduced mass times approach speed squared.',
    symbols: 'E: relative kinetic energy · μ: reduced mass of the two worlds · v: relative speed'
  },
  'relativity-speed': {
    math: '<mi>Δt′</mi><mo>=</mo><mi>γ</mi><mo>(</mo><mi>Δt</mi><mo>−</mo><mfrac><mrow><mi>v</mi><mi>Δx</mi></mrow><msup><mi>c</mi><mn>2</mn></msup></mfrac><mo>)</mo>',
    label: 'Moving observer time difference equals gamma times the original time difference minus speed times distance divided by light speed squared.',
    symbols: 'Δt′: moving observer’s time gap · Δt: original time gap · v: observer speed · Δx: separation · c: light speed · γ: 1/√(1 − v²/c²)'
  },
  impulse: {
    math: '<msub><mi>v</mi><mtext>after</mtext></msub><mo>=</mo><msub><mi>v</mi><mtext>before</mtext></msub><mo>+</mo><mi>Δv</mi>',
    label: 'Velocity after the push equals velocity before the push plus the change in velocity.',
    symbols: 'v: velocity · Δv: velocity added by one push. The push acts in the +Y direction.'
  },
  'dark-matter-mode': {
    math: '<msub><mi>a</mi><mtext>on</mtext></msub><mo>=</mo><msub><mi>a</mi><mtext>gravity</mtext></msub><mo>+</mo><msub><mi>a</mi><mtext>extra</mtext></msub>',
    label: 'Total acceleration equals ordinary gravity plus the extra field acceleration.',
    symbols: 'a: acceleration · extra: the additional field in this comparison'
  },
  'light-frequency': {
    math: '<msub><mi>f</mi><mtext>received</mtext></msub><mo>=</mo><msub><mi>f</mi><mtext>sent</mtext></msub><mo>×</mo><mi>D</mi><mo>×</mo><mi>g</mi>',
    label: 'Received frequency equals sent frequency times Doppler factor times gravitational frequency factor.',
    symbols: 'f: light frequency · D: factor from source and detector motion · g: factor from their gravitational potentials'
  }
});

export function renderLessonRelationship(root, controlKey, fallback) {
  const expression = root.querySelector('#scientist-equation-expression');
  const symbols = root.querySelector('#scientist-equation-symbols');
  const relationship = relationships[controlKey];
  expression.dataset.relationship = controlKey;
  if (!relationship) { expression.textContent = fallback; symbols.textContent = ''; return; }
  // Markup is a fixed local allowlist, never supplied by a learner or model.
  expression.innerHTML = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${relationship.label}">${relationship.math}</math>`;
  symbols.textContent = relationship.symbols;
}
