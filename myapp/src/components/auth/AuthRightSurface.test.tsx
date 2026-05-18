import { render, screen } from '@testing-library/react';
import { AuthRightSurface } from './AuthRightSurface';

describe('AuthRightSurface', () => {
  it('renders right-only blob and spotlight layers around children', () => {
    render(
      <AuthRightSurface>
        <div>form</div>
      </AuthRightSurface>,
    );

    const surface = screen.getByTestId('auth-right-surface');
    const blobLayer = screen.getByTestId('auth-blob-layer');
    const spotlightLayer = screen.getByTestId('auth-spotlight-layer');

    expect(surface).toBeTruthy();
    expect(blobLayer).toBeTruthy();
    expect(spotlightLayer).toBeTruthy();
    expect(surface.contains(blobLayer)).toBe(true);
    expect(surface.contains(spotlightLayer)).toBe(true);
    expect(screen.getByText('form')).toBeTruthy();
  });

  it('does not render left-panel or blue blob layers on the right surface', () => {
    render(
      <AuthRightSurface>
        <div>form</div>
      </AuthRightSurface>,
    );

    const surface = screen.getByTestId('auth-right-surface');
    const rightLayerNames = [
      surface.getAttribute('data-blob-placement'),
      screen.getByTestId('auth-blob-layer').getAttribute('data-layer'),
      screen.getByTestId('auth-spotlight-layer').getAttribute('data-layer'),
    ].join(' ');

    expect(rightLayerNames).not.toMatch(/left|blue/i);
  });
});
