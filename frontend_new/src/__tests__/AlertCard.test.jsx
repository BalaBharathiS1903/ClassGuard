import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AlertCard from '../components/AlertCard';

describe('AlertCard Component', () => {
  it('renders alert information correctly', () => {
    render(
      <BrowserRouter>
        <AlertCard type="roaming" time="5 mins ago" severity="high" />
      </BrowserRouter>
    );
    
    expect(screen.getByText('roaming')).toBeInTheDocument();
    expect(screen.getByText('5 mins ago')).toBeInTheDocument();
  });
});
