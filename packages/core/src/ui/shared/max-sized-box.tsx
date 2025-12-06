import React from 'react';
import { Box, BoxProps } from 'ink';

interface MaxSizedBoxProps extends Omit<BoxProps, 'height' | 'width'> {
  maxHeight?: number;
  maxWidth?: number;
  children: React.ReactNode;
}

/**
 * A Box component that respects maximum size constraints.
 * Uses Ink's dimension props to limit content area.
 *
 * Note: Ink's Box uses flexbox layout. Setting height/width
 * acts as the size constraint. Content exceeding these bounds
 * will be clipped by the terminal.
 */
export const MaxSizedBox: React.FC<MaxSizedBoxProps> = ({
  maxHeight,
  maxWidth,
  children,
  ...props
}) => {
  return (
    <Box
      flexDirection="column"
      height={maxHeight}
      width={maxWidth}
      overflow="hidden"
      {...props}
    >
      {children}
    </Box>
  );
};