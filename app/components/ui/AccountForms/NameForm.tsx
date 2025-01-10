'use client';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { updateName } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UserDetails } from '@/app/types/user'; // Importing the UserDetails type

type NameFormProps = {
  userName: UserDetails['full_name']; // Type `userName` using UserDetails type for consistency
};

export default function NameForm({ userName }: NameFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default form submission behavior.

    const newName = e.currentTarget.fullName.value.trim();

    // Check if the new name is the same as the old name
    if (newName === userName) {
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true); // Only set to submitting if there is actually something to submit.

    try {
      // Await the handleRequest call so that we only set isSubmitting back to false once completed
      await handleRequest(e, updateName, router);
    } catch (error) {
      console.error('Failed to update name:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      title="Your Name"
      description="Please enter your full name, or a display name you are comfortable with."
      footer={
        <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <p className="pb-4 sm:pb-0">64 characters maximum</p>
          <Button
            variant="slim"
            type="submit"
            form="nameForm"
            loading={isSubmitting}
          >
            Update Name
          </Button>
        </div>
      }
    >
      <div className="mt-8 mb-4 text-xl font-semibold">
        <form id="nameForm" onSubmit={handleSubmit}>
          <input
            type="text"
            name="fullName"
            className="w-1/2 p-3 rounded-md bg-zinc-800"
            defaultValue={userName}
            placeholder="Your name"
            maxLength={64}
          />
        </form>
      </div>
    </Card>
  );
}
