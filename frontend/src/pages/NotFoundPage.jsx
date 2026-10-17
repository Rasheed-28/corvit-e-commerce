import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Compass } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="py-16 max-w-2xl mx-auto">
      <EmptyState
        icon={<Compass className="w-8 h-8 text-emerald-600 animate-spin" style={{ animationDuration: '8s' }} />}
        title="404 — Page Not Found"
        description="The page or collection you are looking for may have been moved, renamed, or is temporarily unavailable."
        action={
          <Link to="/">
            <Button variant="primary" size="md">
              Return to Storefront
            </Button>
          </Link>
        }
        secondaryAction={
          <Link to="/products">
            <Button variant="outline" size="md">
              Browse All Products
            </Button>
          </Link>
        }
      />
    </div>
  );
};
