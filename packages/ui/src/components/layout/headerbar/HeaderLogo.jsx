import React from 'react';
import { Link } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const HeaderLogo = ({
  isMobile,
  isConsoleRoute,
  logo,
  logoLoaded,
  isLoading,
}) => {
  if (isMobile && isConsoleRoute) {
    return null;
  }

  return (
    <Link to='/' className='group flex items-center'>
      <div className='relative w-8 h-8 md:w-8 md:h-8'>
        <SkeletonWrapper loading={isLoading || !logoLoaded} type='image' />
        <img
          src={logo}
          alt='logo'
          className={`absolute inset-0 w-full h-full transition-all duration-200 group-hover:scale-110 ${!isLoading && logoLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    </Link>
  );
};

export default HeaderLogo;
