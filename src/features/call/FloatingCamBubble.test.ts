import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FloatingCamBubble } from './FloatingCamBubble';

describe('FloatingCamBubble component exports and contract', () => {
  it('exports FloatingCamBubble component', () => {
    expect(typeof FloatingCamBubble).toBe('function');
  });

  it('renders expanded state by default with full video container', () => {
    const html = renderToStaticMarkup(
      React.createElement(FloatingCamBubble, {
        partnerName: 'Alice',
        isCamOn: true,
        isMicOn: true,
        defaultCollapsed: false,
      }),
    );
    expect(html).toContain('data-testid="floating-cam-bubble"');
    expect(html).toContain("Alice&#x27;s camera floating bubble");
    expect(html).toContain('aspect-video');
    expect(html).toContain('title="Collapse camera"');
  });

  it('renders collapsed state with small rounded bubble and low opacity', () => {
    const html = renderToStaticMarkup(
      React.createElement(FloatingCamBubble, {
        partnerName: 'Bob',
        isCamOn: false,
        isMicOn: false,
        defaultCollapsed: true,
      }),
    );
    expect(html).toContain('data-testid="floating-cam-bubble"');
    expect(html).toContain('rounded-full');
    expect(html).toContain('opacity-25');
    expect(html).toContain('B'); // Initial
  });
});
