import { Box, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <VStack
      spacing={2}
      py={12}
      px={6}
      border="1px dashed"
      borderColor="carbon.700"
      borderRadius="lg"
      textAlign="center"
    >
      <Box w="10px" h="10px" borderRadius="full" bg="healthy.500" mb={2} />
      <Text fontWeight={500}>{title}</Text>
      {body && (
        <Text fontSize="sm" color="text.muted" maxW="48ch">
          {body}
        </Text>
      )}
      {action}
    </VStack>
  );
}
