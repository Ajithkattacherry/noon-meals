import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Recipes from './Recipes'
import { listRecipes, saveRecipe } from '../data/recipes'
import { listIngredients } from '../data/ingredients'

vi.mock('../data/recipes', () => ({
  listRecipes: vi.fn(),
  saveRecipe: vi.fn(),
}))

vi.mock('../data/ingredients', () => ({
  listIngredients: vi.fn(),
}))

const ingredients = [
  { id: 'onion', name: 'Onion', unit: 'Kg' as const, active: true },
  { id: 'tomato', name: 'Tomato', unit: 'Kg' as const, active: true },
  { id: 'chilli', name: 'Green Chilli', unit: 'Kg' as const, active: true },
  { id: 'coconut', name: 'Coconut', unit: 'Each' as const, active: true },
]

const savedCurry = {
  id: 'curry',
  name: 'Vegetable Curry',
  baseServings: 50,
  active: true,
  items: [
    { ingredientId: 'onion', quantity: 2, unit: 'Kg' as const },
    { ingredientId: 'tomato', quantity: 1, unit: 'Kg' as const },
    { ingredientId: 'chilli', quantity: 250, unit: 'Gram' as const },
    { ingredientId: 'coconut', quantity: 5, unit: 'Each' as const },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listRecipes).mockResolvedValue([])
  vi.mocked(listIngredients).mockResolvedValue(ingredients)
  vi.mocked(saveRecipe).mockResolvedValue(savedCurry)
})

describe('Recipes screen', () => {
  it('rejects a base serving count of zero', async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    await screen.findByText('No recipes yet. Add one with its base serving count.')
    await user.type(screen.getByLabelText('Recipe name'), 'Test Curry')
    await user.clear(screen.getByLabelText('Base servings'))
    await user.type(screen.getByLabelText('Base servings'), '0')
    await user.click(screen.getByRole('button', { name: 'Save recipe' }))

    expect(await screen.findByText('Base servings must be greater than zero.')).toBeInTheDocument()
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it('rejects a recipe without ingredients', async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    await screen.findByText('No recipes yet. Add one with its base serving count.')
    await user.type(screen.getByLabelText('Recipe name'), 'Test Curry')
    await user.click(screen.getByRole('button', { name: 'Save recipe' }))

    expect(await screen.findByText('Add at least one ingredient.')).toBeInTheDocument()
    expect(saveRecipe).not.toHaveBeenCalled()
  })

  it('offers only compatible units for an ingredient', async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    await screen.findByText('No recipes yet. Add one with its base serving count.')
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }))
    await user.selectOptions(screen.getByLabelText('Ingredient for item 1'), 'onion')

    const unitSelect = screen.getByLabelText('Unit for item 1')
    const options = within(unitSelect).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Select unit', 'Kg', 'Gram'])
  })

  it('saves Vegetable Curry with four ingredient items', async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    await screen.findByText('No recipes yet. Add one with its base serving count.')
    await user.type(screen.getByLabelText('Recipe name'), 'Vegetable Curry')
    await user.clear(screen.getByLabelText('Base servings'))
    await user.type(screen.getByLabelText('Base servings'), '50')

    const rows = [
      { ingredient: 'onion', quantity: '2', unit: 'Kg' },
      { ingredient: 'tomato', quantity: '1', unit: 'Kg' },
      { ingredient: 'chilli', quantity: '250', unit: 'Gram' },
      { ingredient: 'coconut', quantity: '5', unit: 'Each' },
    ]

    for (const [index, row] of rows.entries()) {
      await user.click(screen.getByRole('button', { name: 'Add ingredient' }))
      await user.selectOptions(
        screen.getByLabelText(`Ingredient for item ${index + 1}`),
        row.ingredient,
      )
      await user.type(screen.getByLabelText(`Quantity for item ${index + 1}`), row.quantity)
      await user.selectOptions(screen.getByLabelText(`Unit for item ${index + 1}`), row.unit)
    }

    await user.click(screen.getByRole('button', { name: 'Save recipe' }))

    expect(saveRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Vegetable Curry',
        baseServings: 50,
        items: [
          { ingredientId: 'onion', quantity: 2, unit: 'Kg' },
          { ingredientId: 'tomato', quantity: 1, unit: 'Kg' },
          { ingredientId: 'chilli', quantity: 250, unit: 'Gram' },
          { ingredientId: 'coconut', quantity: 5, unit: 'Each' },
        ],
      }),
    )
  })
})
