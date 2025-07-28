import { z } from "zod";

// Flattened schema without circular references or complex nested schemas
// All objects are inlined to avoid $ref references in JSON Schema conversion
export const webDSLSchema = z.object({
    description: z.string().describe("A brief summary of the web page's purpose and main functionality. E.g., 'An interactive educational platform for learning quantum physics principles through tutorials, simulations, quizzes, progress tracking, and discussion forums.'"),
    metadata: z.object({
        title: z.string().describe("Page title that would appear in the browser tab or window title bar. E.g., 'Quantum Physics Explorer - Learn & Simulate'."),
        metaDescription: z.string().optional().describe("Content for the <meta name=\"description\"> tag."),
        viewport: z.string().optional().describe("Content for the <meta name=\"viewport\"> tag (e.g., 'width=device-width, initial-scale=1.0'). Default usually suffices."),
    }).optional().describe("Metadata about the page."),
    states: z.array(z.object({
        name: z.string().describe("State variable name, should be unique within the 'states' array. Use camelCase. E.g., 'isModalOpen', 'currentUserEmail', 'isLoading', 'currentTutorialStep', 'selectedFilter'. These states can be targeted by events."),
        initialValue: z.string().describe("Initial value of the state variable as a string. For booleans, use 'true' or 'false'. For numbers, string representation e.g., '0'. For objects/arrays, a JSON string representation e.g., '{}', '[]', or a descriptive string if the value is complex or dynamic. E.g., 'false', '\"test@example.com\"', '0', '\"Loading...\"', '{\"theme\": \"dark\"}'. MUST BE A STRING, even for booleans or numbers."),
        description: z.string().optional().describe("Explanation of how and where this state variable is used in the UI. E.g., 'Controls the visibility of the loginErrorAlert element and the text of the submit button.'"),
    })).optional().describe("Global or page-level state variables that can be used and modified by elements and events. These define the dynamic aspects of the UI."),
    elements: z.array(z.object({
        id: z.string().describe("Unique identifier for the element. Use descriptive camelCase or kebab-case (e.g., 'loginFormButton', 'user-profile-card'). This ID is referenced by events and parentId."),
        parentId: z.string().optional().describe("ID of the parent element, if any. Omit for root elements. Must match an existing element 'id'."),
        elementType: z.string().describe("Element type. Use standard HTML tags (e.g., 'div', 'button', 'input', 'img', 'a', 'span', 'ul', 'form', 'section') or conceptual custom component names (e.g., 'productCard', 'navigationBar', 'userProfile', 'dataGrid', 'accordion', 'tabGroup', 'carousel', 'timeline')."),
        content: z.string().optional().describe("The ACTUAL, specific displayable text content or label for the element (e.g., 'Submit Application', 'Welcome to Quantum Explorer!', 'What is superposition?'). For images, this can be a detailed caption if not using 'alt' in attributes. AVOID generic placeholders like 'Sample Text' or 'Description here' - be specific and provide real content. For container elements (like 'div', 'section'), this field might be omitted if content is provided by child elements or structured list properties like 'navItems', 'listItems', etc."),
        className: z.array(z.string()).optional().describe("Array of Tailwind CSS utility classes for styling. E.g., ['text-blue-500', 'font-bold', 'p-4', 'bg-red-100']."),
        layout: z.object({
            position: z.string().optional().describe("CSS position property (e.g., 'relative', 'absolute', 'fixed')."),
            display: z.string().optional().describe("CSS display property (e.g., 'block', 'flex', 'grid', 'inline-block')."),
            flexDirection: z.string().optional().describe("CSS flex-direction property (e.g., 'row', 'column'). Only applies if display is 'flex'."),
            justifyContent: z.string().optional().describe("CSS justify-content property (e.g., 'center', 'space-between'). Only applies if display is 'flex' or 'grid'."),
            alignItems: z.string().optional().describe("CSS align-items property (e.g., 'center', 'flex-start'). Only applies if display is 'flex' or 'grid'."),
            gap: z.string().optional().describe("CSS gap property for flex or grid containers (e.g., '4px', '1rem')."),
            margin: z.string().optional().describe("CSS margin property (e.g., '10px', 'auto', '2rem 1rem')."),
            padding: z.string().optional().describe("CSS padding property (e.g., '10px', '2rem 1rem')."),
            width: z.string().optional().describe("CSS width property (e.g., '100%', '300px', 'w-1/2')."),
            height: z.string().optional().describe("CSS height property (e.g., '100vh', '200px', 'h-full')."),
        }).optional().describe("Positioning and layout information using CSS properties. Tailwind CSS classes in 'className' field are often preferred for styling."),
        functionality: z.string().describe("Description of the element's purpose or function from a user's perspective. E.g., 'Allows the user to submit their credentials' or 'Displays the product image and allows adding to cart'. Be specific about what the user can achieve with this element."),
        attributes: z.object({
            href: z.string().optional().describe("URL for anchor (<a>) elements."),
            src: z.string().optional().describe("Source URL for image (<img>), video, or other media elements. MUST be a specific, valid URL (e.g., 'https://example.com/images/hero.jpg') or a descriptive placeholder URL (e.g., 'https://placehold.co/600x400?text=Quantum+Simulation+Screenshot'). Avoid generic values."),
            alt: z.string().optional().describe("Alternative text for images (<img>) or other media. CRUCIAL for accessibility. MUST be descriptive and convey the meaning or purpose of the image (e.g., 'Detailed diagram of a quantum circuit' or 'User avatar for Jane Doe'). Do not use generic terms like 'image' or 'picture'."),
            type: z.string().optional().describe("Type attribute for input elements (e.g., 'text', 'password', 'checkbox', 'email') or button elements ('button', 'submit', 'reset')."),
            value: z.string().optional().describe("Default value for form elements like input, select, textarea."),
            placeholder: z.string().optional().describe("Placeholder text for input fields. Should be a helpful hint, not a label."),
            required: z.string().optional().describe("Specifies if an input field must be filled out. Value should be 'true' or 'false' as a string, or the attribute name itself like 'required'."),
            disabled: z.string().optional().describe("Specifies if an element should be disabled. Value should be 'true' or 'false' as a string, or the attribute name itself like 'disabled'."),
            name: z.string().optional().describe("Name attribute for form elements, used when submitting forms."),
            id: z.string().optional().describe("HTML 'id' attribute. Note: The primary element identifier in this DSL is the top-level 'id' field of the elementSchema, not this attribute, though they can be the same."),
            target: z.string().optional().describe("Target attribute for anchor (<a>) elements (e.g., '_blank', '_self')."),
            rel: z.string().optional().describe("Rel attribute for anchor (<a>) elements (e.g., 'noopener noreferrer')."),
            ariaLabel: z.string().optional().describe("ARIA label for accessibility, provides a string label for an element."),
            ariaDescribedBy: z.string().optional().describe("ARIA describedby attribute, refers to the ID of another element that describes this one."),
            role: z.string().optional().describe("ARIA role for the element (e.g., 'button', 'navigation', 'main', 'dialog')."),
        }).optional().describe("Standard HTML attributes for the element. Prioritize semantic attributes and accessibility."),
        events: z.array(z.object({
            type: z.string().describe("Event type (e.g., 'onClick', 'onChange', 'onSubmit', 'onHover', 'onScroll'). Standard browser event types."),
            handlerDescription: z.string().describe("Description of what should happen when the event occurs. Be specific about the user-visible outcome or state change. Example: 'Submits the login form and navigates to the dashboard' or 'Toggles the visibility of the settingsPanel element.'"),
            affects: z.array(z.object({
                target: z.string().describe("ID of the element or state variable being affected by this event. Must match an existing element 'id' or a state 'name'."),
                action: z.string().describe("Action to perform on the target (e.g., 'updateState', 'setStyle', 'toggleClass', 'setAttribute', 'navigateTo', 'triggerAnimation', 'callFunction')."),
                details: z.string().optional().describe("Additional details or parameters for the action. For 'updateState', the new value or how to derive it (e.g., '{ \"isOpen\": true }'). For 'navigateTo', the URL or route. For 'setStyle', an object of CSS properties (e.g., '{ \"backgroundColor\": \"blue\" }')."),
                animation: z.object({
                    type: z.string().optional().describe("Animation type (e.g., 'fadeIn', 'slideUp', 'pulse', 'shake'). Pre-defined or custom animation names."),
                    duration: z.number().optional().describe("Animation duration in milliseconds (e.g., 300)."),
                    easing: z.string().optional().describe("Animation easing function (e.g., 'linear', 'ease-in', 'ease-out', 'ease-in-out')."),
                }).optional().describe("Animation details for visual feedback on the target element."),
                transition: z.object({
                    property: z.string().optional().describe("CSS property to transition (e.g., 'opacity', 'transform', 'backgroundColor')."),
                    duration: z.number().optional().describe("Transition duration in milliseconds (e.g., 500)."),
                    timing: z.string().optional().describe("Transition timing function (e.g., 'ease', 'linear', 'cubic-bezier(...)')."),
                }).optional().describe("CSS transition details for smooth property changes on the target element."),
            })).optional().describe("Elements or states this event affects, and how they are affected."),
            feedback: z.object({
                visual: z.object({
                    type: z.string().optional().describe("Visual feedback type for the event source element (e.g., 'ripple', 'glow', 'borderHighlight')."),
                    color: z.string().optional().describe("Feedback color"),
                    duration: z.number().optional().describe("Feedback duration in milliseconds"),
                }).optional().describe("Visual feedback for user interaction"),
                sound: z.object({
                    type: z.string().optional().describe("Sound feedback type"),
                    volume: z.number().optional().describe("Sound volume (0-1)"),
                }).optional().describe("Sound feedback for user interaction"),
            }).optional().describe("User feedback mechanisms"),
        })).optional().describe("Array of interactive events and their handlers associated with this element."),
        order: z.number().optional().describe("Optional integer to specify display order among sibling elements. Lower numbers typically appear first."),
        interactions: z.object({
            hover: z.object({
                className: z.array(z.string()).optional().describe("Array of Tailwind CSS classes to apply on hover. E.g., ['bg-blue-700', 'text-white']."),
                transform: z.string().optional().describe("CSS transform to apply on hover (e.g., 'scale(1.05)', 'translateY(-2px)')."),
                animationHint: z.string().optional().describe("Suggests a type of animation for hover state (e.g., 'subtlePulse', 'liftUp')."),
            }).optional().describe("Styles and animations to apply when the mouse hovers over the element."),
            focus: z.object({
                className: z.array(z.string()).optional().describe("Array of Tailwind CSS classes to apply on focus. E.g., ['ring-2', 'ring-blue-500']."),
                outline: z.string().optional().describe("CSS outline style on focus (e.g., '2px solid blue'). Note: Tailwind focus rings are often preferred."),
                animationHint: z.string().optional().describe("Suggests an animation for focus state (e.g., 'focusBounce')."),
            }).optional().describe("Styles and animations to apply when the element receives focus."),
            active: z.object({
                className: z.array(z.string()).optional().describe("Array of Tailwind CSS classes to apply when the element is active (e.g., clicked). E.g., ['bg-blue-800']."),
                transform: z.string().optional().describe("CSS transform to apply when active (e.g., 'scale(0.98)')."),
                animationHint: z.string().optional().describe("Suggests an animation for active state (e.g., 'clickFeedback')."),
            }).optional().describe("Styles and animations for active state"),
        }).optional().describe("Interactive state styles and animations. These provide visual cues for user interactions."),
        animationHint: z.string().optional().describe("Suggests a general entrance, exit, or recurring animation for this element (e.g., 'fadeInOnLoad', 'slideInFromLeft', 'pulseSlowly', 'shimmerLoading'). Should be a descriptive name or type that implies a specific animation effect."),

        // Simplified structured content arrays (flattened to avoid complex references)
        navItems: z.array(z.object({
            id: z.string().describe("Unique ID for the navigation item."),
            textContent: z.string().describe("Actual display text for the navigation link (e.g., 'Home', 'About Us', 'Contact')."),
            href: z.string().optional().describe("URL or route for the navigation link."),
            icon: z.string().optional().describe("Optional icon identifier or class."),
            // Simplified children without recursion
            children: z.array(z.object({
                id: z.string().describe("Unique ID for the child navigation item."),
                textContent: z.string().describe("Actual display text for the child navigation link."),
                href: z.string().optional().describe("URL or route for the child navigation link."),
                icon: z.string().optional().describe("Optional icon for the child navigation item."),
            })).optional().describe("Sub-navigation items for creating dropdowns or nested menus."),
        })).optional().describe("If elementType is 'navigationBar', 'mainMenu', 'sidebarNav', etc., this provides a structured list of navigation items."),

        listItems: z.array(z.object({
            id: z.string().describe("Unique ID for the list item."),
            textContent: z.string().optional().describe("Primary text content for the list item."),
            secondaryText: z.string().optional().describe("Optional secondary text or sub-label for the list item."),
            icon: z.string().optional().describe("Optional icon for the list item."),
            image: z.object({
                src: z.string().describe("URL for an image associated with the list item."),
                altText: z.string().describe("Detailed alt text for the list item image."),
            }).optional().describe("Optional image for the list item."),
        })).optional().describe("If elementType is 'customList', 'featureList', 'userList', etc., this provides a structured list of items."),

        formFields: z.array(z.object({
            id: z.string().describe("Unique ID for the form field."),
            label: z.string().describe("Visible label for the form field."),
            fieldType: z.enum(["text", "password", "email", "number", "textarea", "select", "checkbox", "radio", "date", "file", "slider", "toggle"]).describe("Type of form input."),
            name: z.string().describe("Name attribute for the input."),
            placeholder: z.string().optional().describe("Placeholder text for the input field."),
            initialValue: z.string().optional().describe("Initial value for the form field."),
            options: z.array(z.object({ value: z.string(), label: z.string() })).optional().describe("Array of options for 'select' or 'radio' field types."),
            validationRules: z.object({
                required: z.boolean().optional().describe("Is this field mandatory?"),
                minLength: z.number().optional().describe("Minimum length for text input."),
                maxLength: z.number().optional().describe("Maximum length for text input."),
                pattern: z.string().optional().describe("Regex pattern for validation."),
                minValue: z.number().optional().describe("Minimum value for number input."),
                maxValue: z.number().optional().describe("Maximum value for number input."),
            }).optional().describe("Validation rules for the field."),
            className: z.array(z.string()).optional().describe("Tailwind CSS classes for styling."),
        })).optional().describe("If elementType is 'formContainer', 'registrationForm', etc., this provides a structured definition of its fields."),

        accordionPanels: z.array(z.object({
            id: z.string().describe("Unique ID for the accordion panel."),
            title: z.string().describe("Title of the accordion panel header."),
            content: z.string().describe("Text content to be displayed when the panel is expanded."),
            isOpenByDefault: z.boolean().optional().describe("Whether this panel is open by default."),
            iconOpen: z.string().optional().describe("Icon for the open state."),
            iconClosed: z.string().optional().describe("Icon for the closed state."),
        })).optional().describe("If elementType is 'accordionGroup', this defines the set of collapsible panels."),

        tabPanels: z.array(z.object({
            id: z.string().describe("Unique ID for the tab panel."),
            title: z.string().describe("Title of the tab button."),
            content: z.string().describe("Text content for the tab panel when active."),
            isActiveByDefault: z.boolean().optional().describe("Whether this tab is active by default."),
            icon: z.string().optional().describe("Optional icon for the tab title."),
        })).optional().describe("If elementType is 'tabGroup', this defines the set of tabs and their content panels."),
    })).describe("A flat list of ALL page elements. Parent-child relationships are defined by the 'parentId' field within each element."),
    flows: z.array(z.object({
        name: z.string().describe("Name of this user flow or interaction sequence."),
        description: z.string().describe("High-level description of what this flow accomplishes for the user."),
        steps: z.array(z.string()).describe("Step-by-step description of the user flow as an array of strings."),
    })).optional().describe("Descriptions of common or important user interaction sequences with the interface."),
});
