

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"



export default async function UserDropdown() {




    //const router = useRouter()


    const handleNavigation = (path: string) => {
        //router.push(path)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="hover:text-indigo-400 transition-colors cursor-pointer">
                Frankify
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"

                >
                    Subscription
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <a
                        className="hover:text-indigo-400 transition-colors cursor-pointer">Log out</a>
                </DropdownMenuItem>

            </DropdownMenuContent>
        </DropdownMenu>
    )
}