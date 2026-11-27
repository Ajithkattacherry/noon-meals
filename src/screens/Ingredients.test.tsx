import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Ingredients from './Ingredients'
import { listIngredients, saveIngredient } from '../data/ingredients'

vi.mock('../data/ingredients', () => ({
  listIngredients: vi.fn(),
  saveIngredient: vi.fn(),
}))

const onion = {
  id: 'onion',
  name: 'Onion',
  unit: 'Kg' as const,
  description: null,
  active: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listIngredients).mockResolvedValue([onion])
  vi.mocked(saveIngredient).mockResolvedValue(onion)
})

describe('Ingredients screen', () => {
  it('requires a unit before saving', async () => {
    const user = userEvent.setup()
    render(<Ingredients />)

    await screen.findByText('Onion')
    await user.type(screen.getByLabelText('Name'), 'Tomato')
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }))

    expect(await screen.findByText('Choose a unit.')).toBeInTheDocument()
    expect(saveIngredient).not.toHaveBeenCalled()
  })

  it('rejects a blank name', async () => {
    const user = userEvent.setup()
    render(<Ingredients />)

    await screen.findByText('Onion')
    await user.selectOptions(screen.getByLabelText('Unit'), 'Kg')
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }))

    expect(await screen.findByText('Enter an ingredient name.')).toBeInTheDocument()
    expect(saveIngredient).not.toHaveBeenCalled()
  })

  it('saves a new ingredient', async () => {
    const user = userEvent.setup()
    render(<Ingredients />)

    await screen.findByText('Onion')
    await user.type(screen.getByLabelText('Name'), 'Tomato')
    await user.selectOptions(screen.getByLabelText('Unit'), 'Kg')
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }))

    expect(saveIngredient).toHaveBeenCalledWith({
      id: undefined,
      name: 'Tomato',
      unit: 'Kg',
      description: '',
      active: true,
    })
  })

  it('deactivates an ingredient instead of deleting it', async () => {
    const user = userEvent.setup()
    render(<Ingredients />)

    await screen.findByText('Onion')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(saveIngredient).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'onion', active: false }),
    )
  })
})
