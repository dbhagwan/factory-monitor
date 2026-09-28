import { Box, Heading, Text } from "@chakra-ui/react";
import { FloorMap } from "../components/FloorMap";
import { useFloor } from "../hooks/useFloor";

/** Full-width floor map, for a wall display or a second screen. */
export function Topology() {
  const { zones, isLoading } = useFloor();
  return (
    <Box px={{ base: 4, md: 6 }} py={5} maxW="1400px" mx="auto">
      <Heading size="md" mb={1}>
        Topology
      </Heading>
      <Text fontSize="sm" color="text.muted" mb={4}>
        Every zone and machine. Colour is the worst open problem; hollow means acknowledged.
      </Text>
      <FloorMap zones={zones} isLoading={isLoading} />
    </Box>
  );
}
