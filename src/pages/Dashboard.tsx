import { Box, Button, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { AlertList } from "../components/AlertList";
import { FloorMap } from "../components/FloorMap";
import { StatusStrip } from "../components/StatusStrip";
import { useFloor } from "../hooks/useFloor";

const RAIL_LIMIT = 8;

export function Dashboard() {
  const { zones, alerts, isLoading, isError } = useFloor();
  const open = alerts.filter((a) => !a.acknowledged);

  return (
    <Box px={{ base: 4, md: 6 }} py={5} maxW="1600px" mx="auto">
      {isError && (
        <Text color="critical.500" mb={3}>
          Could not reach the factory API. Showing whatever loaded.
        </Text>
      )}
      <StatusStrip zones={zones} alerts={alerts} isLoading={isLoading} />

      <Grid
        mt={5}
        gap={5}
        templateColumns={{ base: "1fr", lg: "minmax(0, 2fr) minmax(320px, 1fr)" }}
        alignItems="start"
      >
        <Box>
          <Flex justify="space-between" align="baseline" mb={3}>
            <Heading size="md">Factory floor</Heading>
            <Text fontSize="sm" color="text.muted">
              Select a zone to inspect its machines
            </Text>
          </Flex>
          <FloorMap zones={zones} isLoading={isLoading} />
        </Box>

        <Box>
          <Flex justify="space-between" align="baseline" mb={3}>
            <Heading size="md">Open problems</Heading>
            <Text fontSize="sm" color="text.muted">
              {open.length} open
            </Text>
          </Flex>
          <AlertList alerts={open.slice(0, RAIL_LIMIT)} isLoading={isLoading} compact />
          {open.length > 0 && (
            <Button
              as={RouterLink}
              to="/alerts"
              mt={3}
              size="sm"
              variant="ghost"
              colorScheme="brand"
              w="full"
            >
              {open.length > RAIL_LIMIT
                ? `View all ${open.length} problems`
                : "Manage problems"}
            </Button>
          )}
        </Box>
      </Grid>
    </Box>
  );
}
