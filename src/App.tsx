import { ChakraProvider, Box, Flex, HStack, Text } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { theme } from "./theme";
import { Dashboard } from "./pages/Dashboard";
import { Alerts } from "./pages/Alerts";
import { Topology } from "./pages/Topology";
import { ZoneView } from "./pages/ZoneView";
import { useLiveFeed } from "./hooks/useLiveFeed";
import { LiveIndicator } from "./components/LiveIndicator";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
    },
  },
});

const links = [
  { to: "/", label: "Floor" },
  { to: "/alerts", label: "Problems" },
  { to: "/topology", label: "Topology" },
];

function NavBar() {
  return (
    <Box
      as="header"
      bg="carbon.900"
      borderBottom="1px solid"
      borderColor="carbon.700"
      px={{ base: 4, md: 6 }}
      h="56px"
    >
      <Flex justify="space-between" align="center" h="full">
        <HStack spacing={6}>
          <HStack spacing={2.5}>
            <Box w="10px" h="10px" bg="brand.400" borderRadius="2px" />
            <Text fontWeight={600} fontSize="md" letterSpacing="-0.01em">
              Factory Monitor
            </Text>
          </HStack>
          <HStack as="nav" spacing={1}>
            {links.map((l) => (
              <Box
                key={l.to}
                as={NavLink}
                to={l.to}
                end={l.to === "/"}
                px={3}
                py={1.5}
                borderRadius="md"
                fontSize="sm"
                fontWeight={500}
                color="text.muted"
                _hover={{ color: "ink", bg: "carbon.800" }}
                sx={{ "&.active": { color: "ink", bg: "carbon.800" } }}
              >
                {l.label}
              </Box>
            ))}
          </HStack>
        </HStack>
        <LiveIndicator />
      </Flex>
    </Box>
  );
}

function Shell() {
  useLiveFeed();
  return (
    <Box minH="100vh" bg="carbon.950">
      <NavBar />
      <Box as="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/zones/:zoneId" element={<ZoneView />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </QueryClientProvider>
    </ChakraProvider>
  );
}

export default App;
