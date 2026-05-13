import { fireEvent, render, screen } from '@testing-library/react';
import { CollapsedBar } from '../components/CollapsedBar';

describe('CollapsedBar', () => {
  test('renders agent name and step count', () => {
    render(
      <CollapsedBar
        agent="ResumeCoach"
        runStatus="completed"
        stepCount={4}
        toolCount={1}
        memoryCount={0}
        duration="21s"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/ResumeCoach/)).toBeTruthy();
    expect(screen.getByText(/4 steps/)).toBeTruthy();
    expect(screen.getByText(/1 tool/)).toBeTruthy();
  });

  test('shows expand chevron', () => {
    render(
      <CollapsedBar
        agent="ResumeCoach"
        runStatus="completed"
        stepCount={4}
        toolCount={1}
        memoryCount={0}
        duration="21s"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/expand/)).toBeTruthy();
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(
      <CollapsedBar
        agent="ResumeCoach"
        runStatus="completed"
        stepCount={4}
        toolCount={1}
        memoryCount={0}
        duration="21s"
        onClick={handleClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('shows running indicator when runStatus is running', () => {
    render(
      <CollapsedBar
        agent="CareerCoach"
        runStatus="running"
        stepCount={2}
        toolCount={0}
        memoryCount={0}
        duration="5s"
        onClick={() => {}}
      />,
    );
    expect(screen.getByText(/running/)).toBeTruthy();
  });
});
