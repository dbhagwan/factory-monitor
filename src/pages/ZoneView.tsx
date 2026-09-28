import { Container, Heading } from "@chakra-ui/react";
import { useParams } from "react-router-dom";

export function ZoneView() {
  const { zoneId } = useParams();
  return (
    <Container maxW="container.xl" py={6}>
      <Heading size="md">{zoneId}</Heading>
    </Container>
  );
}
