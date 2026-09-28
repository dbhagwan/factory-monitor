import { Box, HStack, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useEffect, useState } from "react";
import { useLiveStatus } from "../lib/telemetryStore";

const ping = keyframes`
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(2.6); opacity: 0; }
`;

/** Connection dot. Ripples once each time a message arrives. */
export function LiveIndicator() {
  const { connected, lastMessageAt, messageCount } = useLiveStatus();
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const age = lastMessageAt ? Math.round((Date.now() - lastMessageAt) / 1000) : null;
  const label = !connected
    ? "Disconnected"
    : age === null || age < 5
    ? "Live"
    : `Live · ${age}s ago`;

  return (
    <HStack spacing={2} fontSize="sm" color="text.muted">
      <Box position="relative" w="8px" h="8px">
        <Box
          position="absolute"
          inset={0}
          borderRadius="full"
          bg={connected ? "healthy.500" : "critical.500"}
        />
        {connected && (
          <Box
            key={messageCount}
            position="absolute"
            inset={0}
            borderRadius="full"
            bg="healthy.500"
            animation={`${ping} 900ms ease-out forwards`}
          />
        )}
      </Box>
      <Text whiteSpace="nowrap" display={{ base: "none", sm: "block" }}>
        {label}
      </Text>
    </HStack>
  );
}
